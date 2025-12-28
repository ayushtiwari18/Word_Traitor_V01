import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { roomId, settings, profileId } = await req.json();

    if (!roomId) {
      return new Response(
        JSON.stringify({ error: "roomId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profileId) {
      return new Response(
        JSON.stringify({ error: "profileId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get room info
    const { data: room, error: roomErr } = await supabase
      .from("game_rooms")
      .select("id, host_id, status, current_round")
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

    // Get all participants
    const { data: participants, error: partErr } = await supabase
      .from("room_participants")
      .select("user_id")
      .eq("room_id", roomId);

    if (partErr || !participants || participants.length < 2) {
      return new Response(
        JSON.stringify({ error: "Not enough players" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const numTraitors = settings?.traitors || 1;
    const wordLevel = settings?.wordLevel || "medium";

    // Get a random word pair based on difficulty
    const { data: wordPairs, error: wordErr } = await supabase
      .from("word_pairs")
      .select("*")
      .limit(50);

    if (wordErr || !wordPairs || wordPairs.length === 0) {
      return new Response(
        JSON.stringify({ error: "No word pairs available" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pick a random word pair
    const selectedPair = wordPairs[Math.floor(Math.random() * wordPairs.length)];
    const civilianWord = selectedPair.civilian_word;
    const traitorWord = selectedPair.traitor_word;

    // Shuffle participants and assign roles
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const traitorIds = shuffled.slice(0, numTraitors).map(p => p.user_id);

    // Get current round number
    const roundNumber = (room.current_round || 0) + 1;

    // Create round_secrets for each player
    const secrets = participants.map(p => ({
      room_id: roomId,
      user_id: p.user_id,
      round_number: roundNumber,
      secret_word: traitorIds.includes(p.user_id) ? traitorWord : civilianWord,
    }));

    // Insert secrets
    const { error: insertErr } = await supabase
      .from("round_secrets")
      .insert(secrets);

    if (insertErr) {
      console.error("Error inserting secrets:", insertErr);
      return new Response(
        JSON.stringify({ error: "Failed to assign words" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update room with current round
    await supabase
      .from("game_rooms")
      .update({
        current_round: roundNumber,
        status: "playing",
      })
      .eq("id", roomId);

    // Update participant roles (for internal tracking, not revealed to players)
    for (const p of participants) {
      await supabase
        .from("room_participants")
        .update({
          role: traitorIds.includes(p.user_id) ? "traitor" : "civilian",
        })
        .eq("room_id", roomId)
        .eq("user_id", p.user_id);
    }

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
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
