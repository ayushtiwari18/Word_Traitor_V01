import { supabase } from "@/lib/supabaseClient";

/**
 * Handles a player leaving the game room safely.
 * - Deletes the participant record.
 * - If the player was the HOST, promotes the next available player to host.
 * - If no players remain, deletes the room.
 * 
 * @param {string} roomId - The UUID of the room
 * @param {string} profileId - The UUID of the user leaving
 * @param {boolean} isHost - Whether the leaver is currently the host
 * @returns {Promise<void>}
 */
export const leaveGameRoom = async (roomId, profileId, isHost) => {
  if (!roomId || !profileId) return;

  try {
    console.log(`🚪 Leaving room ${roomId} (Host: ${isHost})`);

    // 1. Delete participant
    const { error: deleteError } = await supabase
      .from("room_participants")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", profileId);

    if (deleteError) {
      console.error("Error leaving room:", deleteError);
      return; 
    }

    // 2. Fetch remaining players to determine fate of room
    const { data: remainingPlayers, error: remainingErr } = await supabase
      .from("room_participants")
      .select("user_id, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true }); // Oldest first

    if (remainingErr) {
      console.error("Error fetching remaining players:", remainingErr);
      return;
    }

    // 3. Handle Host Transfer or Room Destruction
    if (!remainingPlayers || remainingPlayers.length === 0) {
      console.log("🔥 No players left. Deleting room.");
      await supabase.from("game_rooms").delete().eq("id", roomId);
    } else if (isHost) {
      // Promote the oldest remaining player (first in array due to sort)
      const newHost = remainingPlayers[0];
      console.log(`👑 Promoting new host: ${newHost.user_id}`);
      
      await supabase
        .from("game_rooms")
        .update({ host_id: newHost.user_id })
        .eq("id", roomId);
    }
  } catch (err) {
    console.error("Critical error in leaveGameRoom:", err);
  }
};
