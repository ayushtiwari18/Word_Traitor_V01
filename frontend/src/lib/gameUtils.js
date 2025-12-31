import { supabase } from "@/lib/supabaseClient";

/**
 * Handles a player leaving the game room safely.
 * - Deletes the participant record.
 * - If the player was the HOST, promotes the next available player to host.
 * - If no players remain, deletes the room.
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

/**
 * Promotes the oldest participant to be the new host.
 * Used when Presence detects the host has disconnected properly or improperly.
 */
export const promoteNewHost = async (roomId, excludeUserId = null) => {
  try {
    // Fetch all participants
    const { data: players } = await supabase
      .from("room_participants")
      .select("user_id, created_at")
      .eq("room_id", roomId)
      .neq("user_id", excludeUserId || "00000000-0000-0000-0000-000000000000") // Exclude the old host if known
      .order("created_at", { ascending: true });

    if (!players || players.length === 0) {
      console.log("No candidates for host promotion. Room might be empty.");
      // Optional: Delete room if truly empty, but risky if fetch failed
      return;
    }

    const newHost = players[0];
    console.log(`👑 Auto-promoting new host via Presence: ${newHost.user_id}`);

    await supabase
      .from("game_rooms")
      .update({ host_id: newHost.user_id })
      .eq("id", roomId);

  } catch (err) {
    console.error("Error promoting new host:", err);
  }
};

/**
 * Removes a player from the room (Ghost Cleanup).
 * Called by the Host when they detect a stale presence.
 */
export const removeGhostPlayer = async (roomId, userId) => {
  if (!roomId || !userId) return;
  try {
    console.log(`👻 Reaper: Removing ghost player ${userId}`);
    await supabase
      .from("room_participants")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", userId);
  } catch (err) {
    console.error("Error removing ghost:", err);
  }
};
