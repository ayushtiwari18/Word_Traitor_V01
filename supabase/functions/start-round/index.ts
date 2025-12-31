import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 🛡️ FALLBACK WORDS
// Ensures game starts even if database 'word_pairs' table is empty or fails.
const FALLBACK_WORDS = [
  { civilian_word: "Silent Desire", traitor_word: "Unspoken Thought", difficulty: "hard_18plus" },
  { civilian_word: "Desperate Texts", traitor_word: "Multiple Messages", difficulty: "medium_18plus" },
  { civilian_word: "Late Night Regret", traitor_word: "Second Thoughts", difficulty: "hard_18plus" },
  { civilian_word: "Sexual Tension", traitor_word: "Awkward Silence", difficulty: "hard_18plus" },
  { civilian_word: "Nudes", traitor_word: "Photos", difficulty: "hard_18plus" },
  { civilian_word: "Touch", traitor_word: "Tap", difficulty: "easy_18plus" },
  { civilian_word: "Sexy", traitor_word: "Hot", difficulty: "easy_18plus" },
  { civilian_word: "Bedroom Politics", traitor_word: "Relationship Rules", difficulty: "easy_18plus" },
  { civilian_word: "Makeout", traitor_word: "Flirting", difficulty: "easy_18plus" },
  { civilian_word: "Private Chat", traitor_word: "Group Chat", difficulty: "easy_18plus" },
  { civilian_word: "Lingerie", traitor_word: "Underwear", difficulty: "easy_18plus" },
  { civilian_word: "Condom", traitor_word: "Balloon", difficulty: "easy_18plus" },
  { civilian_word: "Kink", traitor_word: "Preference", difficulty: "hard_18plus" },
  { civilian_word: "Fetish", traitor_word: "Interest", difficulty: "hard_18plus" },
  { civilian_word: "Shame", traitor_word: "Embarrassment", difficulty: "hard_18plus" },
  { civilian_word: "Bedroom Eyes", traitor_word: "Eye Contact", difficulty: "medium_18plus" },
  { civilian_word: "Heat", traitor_word: "Energy", difficulty: "medium_18plus" },
  { civilian_word: "Physical Attraction", traitor_word: "Mental Attraction", difficulty: "medium_18plus" },
  { civilian_word: "Dominance", traitor_word: "Control", difficulty: "medium_18plus" },
  { civilian_word: "Secret Crush", traitor_word: "Secret Friend", difficulty: "medium_18plus" },
  { civilian_word: "Morning After", traitor_word: "Next Day", difficulty: "hard_18plus" },
  { civilian_word: "Sun", traitor_word: "Moon", difficulty: "easy" },
  { civilian_word: "Coffee", traitor_word: "Tea", difficulty: "medium" },
  { civilian_word: "Beach", traitor_word: "Desert", difficulty: "medium" },
  { civilian_word: "Car", traitor_word: "Truck", difficulty: "easy" }
];

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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Get room info
    const { data: room, error: roomErr } = await supabase
      .from("game_rooms")
      .select("id, host_id, status, current_round, settings")
      .eq("id", roomId)
      .single();

    if (roomErr || !room) {
      return new Response(
        JSON.stringify({ error: "Room not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (room.host_id !== profileId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - only host can start the game" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
    
    // 3. Select Word Pair
    let selectedPair = null;
    let wordSource: "db" | "seeded_fallback" | "fallback" = "fallback";
    let wordDebug: Record<string, unknown> = {};
    
    // Try to fetch from DB with filters
    try {
      // NOTE: Your schema uses `word_pairs.category` (not `difficulty`).
      // If we query a non-existent column, PostgREST errors and we fall back.
      const baseQuery = supabase
        .from("word_pairs")
        .select(
          "id, category, civilian_word, civilian_word_description, traitor_word, traitor_word_description"
        );

      const level = settings?.wordLevel || "medium";
      const adultWords = !!settings?.adultWords;

      // Your DB uses categories like: easy_18plus / medium_18plus / hard_18plus.
      // Non-adult sets are typically: easy / medium / hard.
      const primaryCategory = adultWords ? `${level}_18plus` : level;
      wordDebug = { level, adultWords, primaryCategory };

      // 1) Try primary category first
      {
        const { data: filteredPairs, error: filteredErr } = await baseQuery
          .eq("category", primaryCategory)
          .limit(200);

        if (filteredErr) {
          console.error("Error querying word_pairs (filtered):", filteredErr);
        } else if (filteredPairs && filteredPairs.length > 0) {
          selectedPair =
            filteredPairs[Math.floor(Math.random() * filteredPairs.length)];
          wordSource = "db";
          wordDebug = { ...wordDebug, filteredCount: filteredPairs.length };
        }
      }

      // 2) If primary category empty, broaden within adult/non-adult pools
      if (!selectedPair) {
        if (adultWords) {
          const { data: adultPairs, error: adultErr } = await baseQuery
            .ilike("category", "%_18plus")
            .limit(200);

          if (adultErr) {
            console.error("Error querying word_pairs (adult pool):", adultErr);
          } else if (adultPairs && adultPairs.length > 0) {
            selectedPair = adultPairs[Math.floor(Math.random() * adultPairs.length)];
            wordSource = "db";
            wordDebug = { ...wordDebug, adultPoolCount: adultPairs.length };
          }
        } else {
          // Prefer same difficulty without _18plus.
          const { data: levelPairs, error: levelErr } = await baseQuery
            .ilike("category", `${level}%`)
            .not("category", "ilike", "%_18plus")
            .limit(200);

          if (levelErr) {
            console.error("Error querying word_pairs (level pool):", levelErr);
          } else if (levelPairs && levelPairs.length > 0) {
            selectedPair = levelPairs[Math.floor(Math.random() * levelPairs.length)];
            wordSource = "db";
            wordDebug = { ...wordDebug, levelPoolCount: levelPairs.length };
          }

          // If still empty, allow any non-adult word.
          if (!selectedPair) {
            const { data: nonAdultPairs, error: nonAdultErr } = await baseQuery
              .not("category", "ilike", "%_18plus")
              .limit(200);

            if (nonAdultErr) {
              console.error("Error querying word_pairs (non-adult pool):", nonAdultErr);
            } else if (nonAdultPairs && nonAdultPairs.length > 0) {
              selectedPair =
                nonAdultPairs[Math.floor(Math.random() * nonAdultPairs.length)];
              wordSource = "db";
              wordDebug = { ...wordDebug, nonAdultPoolCount: nonAdultPairs.length };
            }
          }
        }
      }

      // 3) Last attempt: any word pair from DB
      if (!selectedPair) {
        const { data: anyPairs, error: anyErr } = await baseQuery.limit(200);

        if (anyErr) {
          console.error("Error querying word_pairs:", anyErr);
        } else if (anyPairs && anyPairs.length > 0) {
          selectedPair = anyPairs[Math.floor(Math.random() * anyPairs.length)];
          wordSource = "db";
          wordDebug = { ...wordDebug, anyCount: anyPairs.length };
        } else {
          console.warn("⚠️ No word_pairs found in DB.");

          // If the table exists but is empty, auto-seed with fallback words once.
          // This keeps your source of truth as `word_pairs` without requiring a manual seed step.
          const seedRows = FALLBACK_WORDS.map((w) => ({
            category: w.difficulty,
            civilian_word: w.civilian_word,
            civilian_word_description: null,
            traitor_word: w.traitor_word,
            traitor_word_description: null,
          }));

          const { error: seedErr } = await supabase.from("word_pairs").insert(seedRows);
          if (seedErr) {
            console.warn("⚠️ Could not seed word_pairs; will use fallback:", seedErr);
          } else {
            const { data: seededPairs } = await baseQuery.limit(200);
            if (seededPairs && seededPairs.length > 0) {
              selectedPair = seededPairs[Math.floor(Math.random() * seededPairs.length)];
              wordSource = "seeded_fallback";
              wordDebug = { ...wordDebug, seededCount: seededPairs.length };
            }
          }
        }
      }
    } catch (e) {
      console.error("Error querying word_pairs:", e);
    }
    
    // Use Fallback if DB failed or empty
    if (!selectedPair) {
        const difficulty = settings?.wordLevel || "medium";
        const filteredFallback = FALLBACK_WORDS.filter(w => w.difficulty === difficulty);
        const pool = filteredFallback.length > 0 ? filteredFallback : FALLBACK_WORDS;
        selectedPair = pool[Math.floor(Math.random() * pool.length)];
      wordSource = "fallback";
    }

    const civilianWord = selectedPair.civilian_word;
    const traitorWord = selectedPair.traitor_word;

    // 4. Assign Roles
    const numTraitors = Math.max(1, Math.min(participants.length - 1, settings?.traitors || 1));
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const traitorIds = shuffled.slice(0, numTraitors).map(p => p.user_id);

    // 5. Create Secrets
    const roundNumber = (room.current_round || 0) + 1;
    const secrets = participants.map(p => ({
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
            hint_baseline: 0 
        }
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
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in start-round:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
