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
        if (currentHostId && !onlineUserIds.includes(currentHostId)) {
          console.warn(`⚠️ Host ${currentHostId} is offline! Initiating transfer.`);
          
          // 3. ELECTION: The oldest remaining online player performs the update
          const randomDelay = Math.floor(Math.random() * 2000);
          setTimeout(() => {
             promoteNewHost(roomId, currentHostId);
          }, randomDelay);
        }

        // LOGIC: Ghost Cleanup (DISABLED TEMPORARILY)
        // We are disabling this to prevent players from disappearing due to race conditions.
        /*
        if (isHost) {
          // Fetch DB participants with their joined time
          const { data: participants } = await supabase
             .from("room_participants")
             .select("user_id, created_at")
             .eq("room_id", roomId);
          
          if (participants) {
            const now = Date.now();
            const GRACE_PERIOD_MS = 10000; // 10 seconds grace period

            const ghosts = participants.filter(p => {
              // Condition 1: Not in presence list
              const isOffline = !onlineUserIds.includes(p.user_id);
              
              // Condition 2: Joined longer ago than grace period
              const joinedAt = new Date(p.created_at).getTime();
              const isOldEnough = (now - joinedAt) > GRACE_PERIOD_MS;

              return isOffline && isOldEnough;
            });
            
            if (ghosts.length > 0) {
              console.log(`👻 Detected ${ghosts.length} STALE ghosts. Cleaning up...`, ghosts);
              ghosts.forEach(g => removeGhostPlayer(roomId, g.user_id));
            }
          }
        }
        */
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    presenceChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, roomId, profileId, isHost]);
};
