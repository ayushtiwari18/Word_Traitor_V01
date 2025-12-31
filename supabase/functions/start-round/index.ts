import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 🛡️ FALLBACK WORDS
// Ensures game starts even if database 'word_pairs' table is empty or fails.
const FALLBACK_WORDS = [
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
    
    // Try to fetch from DB with filters
    try {
      // NOTE: Your schema uses `word_pairs.category` (not `difficulty`).
      // If we query a non-existent column, PostgREST errors and we fall back.
      const baseQuery = supabase
        .from("word_pairs")
        .select(
          "id, category, civilian_word, civilian_word_description, traitor_word, traitor_word_description"
        );

      const desiredCategory = settings?.wordLevel;

      // 1) Try filtered pool first (if category provided)
      if (desiredCategory) {
        const { data: filteredPairs, error: filteredErr } = await baseQuery
          .eq("category", desiredCategory)
          .limit(200);

        if (filteredErr) {
          console.error("Error querying word_pairs (filtered):", filteredErr);
        } else if (filteredPairs && filteredPairs.length > 0) {
          selectedPair =
            filteredPairs[Math.floor(Math.random() * filteredPairs.length)];
        }
      }

      // 2) If filtered pool empty (or no category), fall back to any word pair from DB
      if (!selectedPair) {
        const { data: anyPairs, error: anyErr } = await baseQuery.limit(200);

        if (anyErr) {
          console.error("Error querying word_pairs:", anyErr);
        } else if (anyPairs && anyPairs.length > 0) {
          selectedPair = anyPairs[Math.floor(Math.random() * anyPairs.length)];
        } else {
          console.warn("⚠️ No word_pairs found in DB. Using fallback.");
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
