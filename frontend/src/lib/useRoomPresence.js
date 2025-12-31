import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { promoteNewHost, removeGhostPlayer } from "@/lib/gameUtils";

/**
 * Custom Hook: Manages Realtime Presence for a game room.
 * - Tracks who is online.
 * - Handles auto-promoting a new host if the current host disconnects.
 * - (Disabled temporarily) Allows the Host to cleanup "ghost" players.
 * 
 * @param {string} roomCode - The room code (e.g. ABCD)
 * @param {string} roomId - The room UUID
 * @param {string} profileId - Current user's ID
 * @param {boolean} isHost - Is the current user the host?
 */
export const useRoomPresence = (roomCode, roomId, profileId, isHost) => {
  const presenceChannelRef = useRef(null);
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    if (!roomCode || !profileId || !roomId) return;

    const channelName = `presence_${roomCode}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: profileId,
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, async () => {
        const newState = channel.presenceState();
        const onlineUserIds = Object.keys(newState);
        console.log("🟢 Presence Sync:", onlineUserIds);

        // LOGIC: Host Transfer
        // 1. Fetch current host from DB to be sure
        const { data: roomData } = await supabase
          .from("game_rooms")
          .select("host_id")
          .eq("id", roomId)
          .single();
        
        const currentHostId = roomData?.host_id;

        // 2. If the DB says "Host X", but "Host X" is NOT in onlineUserIds...
        // AND we have a valid list of online users (at least 1 person is online)
        if (currentHostId && !onlineUserIds.includes(currentHostId) && onlineUserIds.length > 0) {
          console.warn(`⚠️ Host ${currentHostId} is offline! Initiating transfer.`);
          
          // 3. ELECTION: The oldest remaining online player performs the update
          // No delay needed due to atomic update in gameUtils
          promoteNewHost(roomId, currentHostId, onlineUserIds);
        }

        // LOGIC: Ghost Cleanup (DISABLED TEMPORARILY)
        /*
        if (isHost) {
          // ... (Ghost cleanup logic) ...
        }
        */
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
          hasTrackedRef.current = true;
        }
      });

    presenceChannelRef.current = channel;

    return () => {
      hasTrackedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [roomCode, roomId, profileId, isHost]);
};
