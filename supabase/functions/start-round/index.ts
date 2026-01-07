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
  { civilian_word: "Sun", traitor_word: "Moon", category: "easy" },
  { civilian_word: "Coffee", traitor_word: "Tea", category: "medium" },
  { civilian_word: "Beach", traitor_word: "Desert", category: "medium" },
  { civilian_word: "Car", traitor_word: "Truck", category: "easy" },
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

    // 3. Select Word Pair with Cooldown System
    let selectedPair = null;

    try {
      const isAdult = settings?.adultWords === true;
      const difficulty = settings?.wordLevel || "medium";
      
      // ⏰ 10-hour cooldown timestamp
      const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();

      // 🎯 STRATEGY: Try to get a word NOT used in last 10 hours
      let query = supabase
        .from("word_pairs")
        .select("id, civilian_word, traitor_word, category, last_used_at", { count: "exact", head: true });

      // Apply cooldown filter (words not used in last 10 hours OR never used)
      query = query.or(`last_used_at.is.null,last_used_at.lt.${tenHoursAgo}`);

      // 🔞 Adult vs Normal Logic
      if (isAdult) {
        query = query.or("category.ilike.%18plus%,category.ilike.%adult%");
      } else {
        query = query
          .not("category", "ilike", "%18plus%")
          .not("category", "ilike", "%adult%");
        
        if (difficulty) {
          query = query.ilike("category", `%${difficulty}%`);
        }
      }

      // 1️⃣ Count available "fresh" words
      const { count, error: countErr } = await query;

      if (!countErr && count && count > 0) {
        // We have fresh words available!
        const randomOffset = Math.floor(Math.random() * count);

        // 2️⃣ Fetch one random fresh word
        let dataQuery = supabase
          .from("word_pairs")
          .select("id, civilian_word, traitor_word, category, last_used_at");
        
        // Re-apply all filters
        dataQuery = dataQuery.or(`last_used_at.is.null,last_used_at.lt.${tenHoursAgo}`);
        
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
          console.log("✅ Selected fresh word (not used in 10h):", data.id);
        }
      } else {
        // ⚠️ NO fresh words available - FALLBACK to least recently used
        console.warn("⚠️ All words in cooldown, selecting least recently used...");
        
        let fallbackQuery = supabase
          .from("word_pairs")
          .select("id, civilian_word, traitor_word, category, last_used_at")
          .order("last_used_at", { ascending: true, nullsFirst: false });

        // Apply category filters (adult/normal + difficulty)
        if (isAdult) {
          fallbackQuery = fallbackQuery.or("category.ilike.%18plus%,category.ilike.%adult%");
        } else {
          fallbackQuery = fallbackQuery
            .not("category", "ilike", "%18plus%")
            .not("category", "ilike", "%adult%");
          if (difficulty) {
            fallbackQuery = fallbackQuery.ilike("category", `%${difficulty}%`);
          }
        }

        const { data: fallbackData } = await fallbackQuery.limit(1).maybeSingle();
        
        if (fallbackData) {
          selectedPair = fallbackData;
          console.log("⏰ Using least recently used word:", fallbackData.id);
        }
      }

      // 🔄 RETRY: If specific difficulty failed (non-adult only), try ANY difficulty
      if (!selectedPair && !isAdult && difficulty) {
        console.log("⚠️ No words for specific difficulty, trying any non-adult word...");
        
        let retryQuery = supabase
          .from("word_pairs")
          .select("id, civilian_word, traitor_word, category, last_used_at")
          .not("category", "ilike", "%18plus%")
          .not("category", "ilike", "%adult%")
          .or(`last_used_at.is.null,last_used_at.lt.${tenHoursAgo}`)
          .limit(1);
        
        const { data: retryData } = await retryQuery.maybeSingle();
        
        if (retryData) {
          selectedPair = retryData;
        } else {
          // Still nothing? Get ANY non-adult word (ignore cooldown)
          const { data: anyData } = await supabase
            .from("word_pairs")
            .select("id, civilian_word, traitor_word, category, last_used_at")
            .not("category", "ilike", "%18plus%")
            .not("category", "ilike", "%adult%")
            .order("last_used_at", { ascending: true, nullsFirst: false })
            .limit(1)
            .maybeSingle();
          
          if (anyData) selectedPair = anyData;
        }
      }
    } catch (e) {
      console.error("❌ Error fetching word from DB:", e);
    }

    // 🛡️ Use FALLBACK_WORDS if DB completely failed
    if (!selectedPair) {
      console.warn("⚠️ Using hardcoded fallback words.");
      const difficulty = settings?.wordLevel || "medium";
      const filteredFallback = FALLBACK_WORDS.filter(
        (w) => w.category === difficulty
      );
      const pool = filteredFallback.length > 0 ? filteredFallback : FALLBACK_WORDS;
      selectedPair = pool[Math.floor(Math.random() * pool.length)];
    }

    const civilianWord = selectedPair.civilian_word;
    const traitorWord = selectedPair.traitor_word;

    // 🔄 UPDATE last_used_at for the selected word (if it has an ID from DB)
    if (selectedPair.id) {
      await supabase
        .from("word_pairs")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", selectedPair.id);
      
      console.log(`📝 Updated last_used_at for word ID: ${selectedPair.id}`);
    }

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

    // 6. Update Participant Roles
    for (const p of participants) {
      await supabase
        .from("room_participants")
        .update({
          role: traitorIds.includes(p.user_id) ? "traitor" : "civilian",
          is_alive: true,
        })
        .eq("room_id", roomId)
        .eq("user_id", p.user_id);
    }
    
    // Clear old game data
    await supabase.from("game_votes").delete().eq("room_id", roomId);
    await supabase.from("game_hints").delete().eq("room_id", roomId);
    await supabase.from("chat_messages").delete().eq("room_id", roomId);

    // 7. Update Room Status & Settings
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
