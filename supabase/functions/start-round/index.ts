import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { roomId, settings, profileId } = await req.json();

    if (!roomId || !profileId) {
      throw new Error("Missing roomId or profileId");
    }

    // 1. Fetch participants
    const { data: participants, error: partError } = await supabase
      .from("room_participants")
      .select("user_id")
      .eq("room_id", roomId);

    if (partError || !participants || participants.length < 2) {
      throw new Error("Not enough players (minimum 2)");
    }

    const userIds = participants.map((p) => p.user_id);
    const playerCount = userIds.length;

    // Validate traitor count
    let traitorCount = settings?.traitors || 1;
    if (traitorCount >= playerCount) {
      traitorCount = Math.max(1, Math.floor(playerCount / 2));
    }

    // 2. Assign roles
    const shuffled = [...userIds].sort(() => Math.random() - 0.5);
    const traitorIds = shuffled.slice(0, traitorCount);
    const citizenIds = shuffled.slice(traitorCount);

    const updates = [
      ...traitorIds.map((uid) => ({
        room_id: roomId,
        user_id: uid,
        role: "traitor",
        is_alive: true,
      })),
      ...citizenIds.map((uid) => ({
        room_id: roomId,
        user_id: uid,
        role: "citizen",
        is_alive: true,
      })),
    ];

    const { error: roleError } = await supabase
      .from("room_participants")
      .upsert(updates, { onConflict: "room_id,user_id" });

    if (roleError) throw roleError;

    // 3. Select Word Pair (Strict Filtering)
    // Priority 1: Exact match (Difficulty + Adult Setting)
    // Priority 2: Fallback to ANY difficulty (keeping Adult Setting strict)
    // Priority 3: Last resort (Any word), but try to respect adult setting if possible

    let wordPair = null;
    const difficulty = settings?.wordLevel || "medium";
    const allowAdult = settings?.adultWords || false;

    // Helper to fetch random word with filters
    const fetchRandomWord = async (diff, adult) => {
      let query = supabase.from("word_pairs").select("*");

      // Filter by difficulty if provided
      if (diff) {
        query = query.ilike("category", `${diff}%`);
      }

      // STRICT Adult Filter
      if (!adult) {
        // NON-ADULT MODE → exclude adult content
        query = query
          .not("category", "ilike", "%18plus%")
          .not("category", "ilike", "%adult%");
      } else {
        // ADULT MODE → ONLY adult content
        query = query.or("category.ilike.%18plus%,category.ilike.%adult%");
      }

      // Get count first to pick random offset
      const { count, error: countErr } = await query.select("*", {
        count: "exact",
        head: true,
      });

      if (countErr || !count) return null;

      const randomOffset = Math.floor(Math.random() * count);
      const { data, error } = await query
        .select("*")
        .range(randomOffset, randomOffset)
        .single();

      return data;
    };

    // Attempt 1: Exact Match
    wordPair = await fetchRandomWord(difficulty, allowAdult);

    // Attempt 2: Same adult setting, ANY difficulty (Fallback)
    if (!wordPair) {
      console.log(
        "⚠️ No words found for difficulty, falling back to any difficulty (same adult setting)"
      );
      wordPair = await fetchRandomWord(null, allowAdult);
    }

    // Attempt 3: If still nothing (e.g. user wanted non-adult but DB only has adult), force ANY word
    // This effectively breaks the "No 18+" rule but prevents game crash.
    if (!wordPair) {
      console.log(
        "⚠️ CRITICAL: No words found at all. Fetching ANY random word."
      );
      const { data } = await supabase
        .from("word_pairs")
        .select("*")
        .limit(1)
        .single();
      wordPair = data;
    }

    if (!wordPair) {
      throw new Error("No word pairs available in database!");
    }

    // 4. Update Room with Phase & Timers
    const now = new Date().toISOString();

    // Clear old state just in case
    await supabase.from("game_votes").delete().eq("room_id", roomId);
    await supabase.from("game_hints").delete().eq("room_id", roomId);
    await supabase.from("chat_messages").delete().eq("room_id", roomId);

    await supabase
      .from("game_rooms")
      .update({
        status: "playing",
        current_round: 1,
        settings: {
          ...settings,
          wordPairId: wordPair.id,
          civilianWord: wordPair.civilian_word,
          traitorWord: wordPair.traitor_word,
          civilianDesc: wordPair.civilian_word_description,
          traitorDesc: wordPair.traitor_word_description,
          wordRevealStartedAt: now,
          voteSession: 1,
          hintRound: 1,
          gameResult: null,
          voteSessionStartedAt: null, // Clear future phase timers
          hintStartedAt: null,
        },
      })
      .eq("id", roomId);

    return new Response(JSON.stringify({ success: true, wordPair }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in start-round:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
