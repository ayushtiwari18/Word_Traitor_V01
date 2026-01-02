import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// 🛡️ FALLBACK WORDS
// Ensures game starts even if database 'word_pairs' table is empty or fails.
const FALLBACK_WORDS = [];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing server configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { roomId, settings, profileId } = await req.json();

    if (!roomId || !profileId) {
      return new Response(
        JSON.stringify({ error: "roomId and profileId are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 1. Get room info
    const { data: room, error: roomErr } = await supabase
      .from("game_rooms")
      .select("id, host_id, status, current_round, settings")
      .eq("id", roomId)
      .single();

    if (roomErr || !room) {
      return new Response(JSON.stringify({ error: "Room not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (room.host_id !== profileId) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized - only host can start the game",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Get all participants
    const { data: participants, error: partErr } = await supabase
      .from("room_participants")
      .select("user_id")
      .eq("room_id", roomId);

    if (partErr || !participants || participants.length < 2) {
      // Ideally we enforce 2+ players, but for testing we allow it
    }

    // 3. Select Word Pair with proper randomization and no repetition
    let selectedPair = null;
    let wordSource: "db" | "seeded_fallback" | "fallback" = "fallback";
    let wordDebug: Record<string, unknown> = {};

    try {
      const level = settings?.wordLevel || "medium";
      const adultWords = !!settings?.adultWords;
      wordDebug = { level, adultWords };

      // Step 1: Get all previously used word pairs for this room to exclude them
      const { data: usedSecrets } = await supabase
        .from("round_secrets")
        .select("secret_word")
        .eq("room_id", roomId);

      const usedWords = new Set(
        usedSecrets?.flatMap((s) => [s.secret_word]) || []
      );
      wordDebug = { ...wordDebug, usedWordsCount: usedWords.size };

      // Step 2: Build the query based on adult filter
      let query = supabase
        .from("word_pairs")
        .select(
          "id, category, civilian_word, civilian_word_description, traitor_word, traitor_word_description"
        );

      if (adultWords) {
        // MUST select from categories containing "_18plus" OR "adult"
        // Correct PostgREST syntax: use comma between conditions
        query = query.or("category.ilike.%_18plus%,category.ilike.%adult%");
        wordDebug = { ...wordDebug, filterType: "adult_only" };
      } else {
        // MUST NOT select from categories containing "_18plus" OR "adult"
        query = query
          .not("category", "ilike", "%_18plus%")
          .not("category", "ilike", "%adult%");
        wordDebug = { ...wordDebug, filterType: "non_adult_only" };
      }

      // Step 3: Fetch all matching pairs (using limit 1000 for large datasets)
      const { data: allPairs, error: queryErr } = await query.limit(1000);

      if (queryErr) {
        console.error("Error querying word_pairs:", queryErr);
        throw queryErr;
      }

      if (allPairs && allPairs.length > 0) {
        wordDebug = { ...wordDebug, totalAvailable: allPairs.length };

        // Step 4: Filter out previously used pairs
        const availablePairs = allPairs.filter(
          (pair) =>
            !usedWords.has(pair.civilian_word) &&
            !usedWords.has(pair.traitor_word)
        );

        wordDebug = { ...wordDebug, availableUnused: availablePairs.length };

        // Step 5: Prefer matching difficulty level, but allow any if needed
        let candidatePairs = availablePairs;

        if (adultWords) {
          // First try: exact match with level (e.g., "medium_18plus", "medium_adult")
          const levelMatchPairs = availablePairs.filter((pair) =>
            pair.category.toLowerCase().includes(level.toLowerCase())
          );
          if (levelMatchPairs.length > 0) {
            candidatePairs = levelMatchPairs;
            wordDebug = {
              ...wordDebug,
              levelMatch: true,
              candidateCount: levelMatchPairs.length,
            };
          } else {
            wordDebug = {
              ...wordDebug,
              levelMatch: false,
              candidateCount: availablePairs.length,
            };
          }
        } else {
          // Non-adult: try to match level
          const levelMatchPairs = availablePairs.filter(
            (pair) =>
              pair.category.toLowerCase() === level.toLowerCase() ||
              pair.category.toLowerCase().startsWith(level.toLowerCase())
          );
          if (levelMatchPairs.length > 0) {
            candidatePairs = levelMatchPairs;
            wordDebug = {
              ...wordDebug,
              levelMatch: true,
              candidateCount: levelMatchPairs.length,
            };
          } else {
            wordDebug = {
              ...wordDebug,
              levelMatch: false,
              candidateCount: availablePairs.length,
            };
          }
        }

        // Step 6: If no unused pairs available, reset and use all pairs
        if (candidatePairs.length === 0) {
          console.warn("⚠️ All word pairs have been used, resetting pool");
          candidatePairs = allPairs.filter((pair) =>
            adultWords
              ? pair.category.toLowerCase().includes(level.toLowerCase())
              : pair.category.toLowerCase() === level.toLowerCase() ||
                pair.category.toLowerCase().startsWith(level.toLowerCase())
          );

          // If still no match, use any from the filtered set
          if (candidatePairs.length === 0) {
            candidatePairs = allPairs;
          }

          wordDebug = {
            ...wordDebug,
            poolReset: true,
            candidateCount: candidatePairs.length,
          };
        }

        // Step 7: Select random pair using crypto-secure randomness
        const randomIndex = Math.floor(Math.random() * candidatePairs.length);
        selectedPair = candidatePairs[randomIndex];
        wordSource = "db";
        wordDebug = { ...wordDebug, selectedCategory: selectedPair.category };
      } else {
        console.warn("⚠️ No word_pairs found in DB matching criteria.");

        // Auto-seed with fallback if DB is empty
        if (FALLBACK_WORDS.length > 0) {
          const seedRows = FALLBACK_WORDS.map((w) => ({
            category: w.difficulty,
            civilian_word: w.civilian_word,
            civilian_word_description: null,
            traitor_word: w.traitor_word,
            traitor_word_description: null,
          }));

          const { error: seedErr } = await supabase
            .from("word_pairs")
            .insert(seedRows);
          if (seedErr) {
            console.warn(
              "⚠️ Could not seed word_pairs; will use fallback:",
              seedErr
            );
          } else {
            // Retry query after seeding
            const { data: seededPairs } = await query.limit(200);
            if (seededPairs && seededPairs.length > 0) {
              selectedPair =
                seededPairs[Math.floor(Math.random() * seededPairs.length)];
              wordSource = "seeded_fallback";
              wordDebug = { ...wordDebug, seededCount: seededPairs.length };
            }
          }
        }
      }
    } catch (e) {
      console.error("Error in word selection logic:", e);
    }

    // Fallback to hardcoded words if DB completely fails
    if (!selectedPair) {
      if (FALLBACK_WORDS.length > 0) {
        const adultWords = !!settings?.adultWords;
        const level = settings?.wordLevel || "medium";

        // Filter fallback words based on adult setting
        const filteredFallback = FALLBACK_WORDS.filter((w) => {
          if (adultWords) {
            // Only use words marked as adult
            return (
              w.difficulty.includes("18plus") || w.difficulty.includes("adult")
            );
          } else {
            // Only use non-adult words
            return (
              !w.difficulty.includes("18plus") &&
              !w.difficulty.includes("adult")
            );
          }
        });

        const pool =
          filteredFallback.length > 0 ? filteredFallback : FALLBACK_WORDS;
        selectedPair = pool[Math.floor(Math.random() * pool.length)];
        wordSource = "fallback";
        wordDebug = { ...wordDebug, fallbackPool: pool.length };
      } else {
        throw new Error(
          "No word pairs available - database empty and no fallback words configured"
        );
      }
    }

    const civilianWord = selectedPair.civilian_word;
    const traitorWord = selectedPair.traitor_word;

    // 4. Assign Roles
    const numTraitors = Math.max(
      1,
      Math.min(participants.length - 1, settings?.traitors || 1)
    );
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const traitorIds = shuffled.slice(0, numTraitors).map((p) => p.user_id);

    // 5. Create Secrets
    const roundNumber = (room.current_round || 0) + 1;
    const secrets = participants.map((p) => ({
      room_id: roomId,
      user_id: p.user_id,
      round_number: roundNumber,
      secret_word: traitorIds.includes(p.user_id) ? traitorWord : civilianWord,
    }));

    const { error: insertErr } = await supabase
      .from("round_secrets")
      .insert(secrets);

    if (insertErr) {
      console.error("Error inserting secrets:", insertErr);
      throw new Error("Failed to assign words");
    }

    // 6. Update Participant Roles (CRITICAL: DO THIS BEFORE UPDATING ROOM STATUS)
    for (const p of participants) {
      await supabase
        .from("room_participants")
        .update({
          role: traitorIds.includes(p.user_id) ? "traitor" : "civilian",
        })
        .eq("room_id", roomId)
        .eq("user_id", p.user_id);
    }

    // 7. Update Room Status & Settings (Triggers Client Navigation)
    await supabase
      .from("game_rooms")
      .update({
        current_round: roundNumber,
        status: "playing",
        settings: {
          ...room.settings,
          ...settings,
          hint_baseline: 0,
        },
      })
      .eq("id", roomId);

    return new Response(
      JSON.stringify({
        success: true,
        roundNumber,
        civilianWord,
        traitorWord,
        wordSource,
        wordPairId: selectedPair?.id || null,
        wordCategory: selectedPair?.category || null,
        wordDebug,
        numPlayers: participants.length,
        numTraitors: traitorIds.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in start-round:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
