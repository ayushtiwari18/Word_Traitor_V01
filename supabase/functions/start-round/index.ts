import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// 🛡️ FALLBACK WORDS
// Ensures game starts even if database 'word_pairs' table is empty or fails.
const FALLBACK_WORDS = [
  { civilian_word: "Sun", traitor_word: "Moon", difficulty: "easy" },
  { civilian_word: "Coffee", traitor_word: "Tea", difficulty: "medium" },
  { civilian_word: "Beach", traitor_word: "Desert", difficulty: "medium" },
  { civilian_word: "Car", traitor_word: "Truck", difficulty: "easy" },
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

    // 3. Select Word Pair (Strict Adult Filtering)
    let selectedPair = null;

    try {
      // Logic for adult filtering vs difficulty
      // settings.adultWords (boolean)
      // settings.wordLevel (string: "easy", "medium", "hard")

      let query = supabase.from("word_pairs").select("*", { count: "exact", head: true });

      const isAdult = settings?.adultWords === true;
      const difficulty = settings?.wordLevel || "medium";

      // 🔞 Adult vs Normal Logic
      if (isAdult) {
         // MUST contain 'adult' or '18plus' in category
         // We use .or() to find matches. Note that this might require exact string matching depending on your DB data.
         // Assuming 'category' is a text column:
         query = query.or("category.ilike.%18plus%,category.ilike.%adult%");
      } else {
         // MUST NOT be adult
         query = query
           .not("category", "ilike", "%18plus%")
           .not("category", "ilike", "%adult%");
         
         // Only apply difficulty filter for non-adult words (optional, but good for variety)
         if (difficulty) {
           query = query.ilike("category", `%${difficulty}%`);
         }
      }

      // 1️⃣ Count rows
      const { count, error: countErr } = await query;

      if (!countErr && count && count > 0) {
        const randomOffset = Math.floor(Math.random() * count);

        // 2️⃣ Fetch exactly one random row using the SAME filters
        let dataQuery = supabase.from("word_pairs").select("civilian_word, traitor_word");
        
        // Re-apply filters for the data fetch
        if (isAdult) {
            dataQuery = dataQuery.or("category.ilike.%18plus%,category.ilike.%adult%");
        } else {
            dataQuery = dataQuery
              .not("category", "ilike", "%18plus%")
              .not("category", "ilike", "%adult%");
            if (difficulty) {
              dataQuery = dataQuery.ilike("category", `%${difficulty}%`);
            }
        }

        const { data, error } = await dataQuery
          .range(randomOffset, randomOffset)
          .maybeSingle();

        if (!error && data) {
          selectedPair = data;
        } else {
          console.warn("⚠️ Random DB row fetch returned no data.");
        }
      } else {
         // Retry logic: If specific difficulty failed (and not adult mode), try ANY difficulty (non-adult)
         if (!isAdult && difficulty) {
             console.log("⚠️ No words found for specific difficulty, trying any non-adult word...");
             let retryQuery = supabase
                .from("word_pairs")
                .select("*")
                .not("category", "ilike", "%18plus%")
                .not("category", "ilike", "%adult%")
                .limit(1);
             
             // Get a random one? (Hard to do efficient random without count, but let's try a small fetch)
             // For simplicity in retry, just fetch one to keep game going.
             const { data: retryData } = await retryQuery.maybeSingle();
             if (retryData) selectedPair = retryData;
         }
      }
    } catch (e) {
      console.error("❌ Error fetching random word from DB:", e);
    }

    // Use Fallback if DB failed or empty
    if (!selectedPair) {
      console.warn("⚠️ Using fallback words.");
      const difficulty = settings?.wordLevel || "medium";
      const filteredFallback = FALLBACK_WORDS.filter(
        (w) => w.difficulty === difficulty
      );
      const pool =
        filteredFallback.length > 0 ? filteredFallback : FALLBACK_WORDS;
      selectedPair = pool[Math.floor(Math.random() * pool.length)];
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
    // ✅ FIX: Increment round number properly based on previous room state
    const roundNumber = (room.current_round || 0) + 1;
    
    // Clear old secrets for this room (optional cleanup)
    // await supabase.from("round_secrets").delete().eq("room_id", roomId);

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
          is_alive: true, // Revive everyone for new round
        })
        .eq("room_id", roomId)
        .eq("user_id", p.user_id);
    }
    
    // Clear old votes/hints/chat for the new round
    await supabase.from("game_votes").delete().eq("room_id", roomId);
    await supabase.from("game_hints").delete().eq("room_id", roomId);
    await supabase.from("chat_messages").delete().eq("room_id", roomId);

    // 7. Update Room Status & Settings (Triggers Client Navigation)
    await supabase
      .from("game_rooms")
      .update({
        current_round: roundNumber,
        status: "playing",
        settings: {
          ...room.settings, // Keep old settings
          ...settings, // Overwrite with new ones (including adultWords if passed)
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
