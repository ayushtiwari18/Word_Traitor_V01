import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { promoteNewHost, removeGhostPlayer } from "@/lib/gameUtils";

/**
 * Custom Hook: Manages Realtime Presence for a game room.
 * - Tracks who is online.
 * - Handles auto-promoting a new host if the current host disconnects.
 * - Allows the Host (only) to cleanup "ghost" players from the DB who are not in presence state.
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
          // This prevents 5 clients from spamming the DB at once.
          // We can't easily know who is "oldest" without fetching participant dates, 
          // but we can just let everyone try to run `promoteNewHost`. 
          // `promoteNewHost` will pick the oldest participant from the DB.
          // To reduce spam, we can add a random delay.
          
          const randomDelay = Math.floor(Math.random() * 2000);
          setTimeout(() => {
             promoteNewHost(roomId, currentHostId);
          }, randomDelay);
        }

        // LOGIC: Ghost Cleanup (Host Only)
        // If I am the host (and I am online, obviously), I should check if there are DB rows for users who are NOT online.
        if (isHost) {
          // Fetch DB participants
          const { data: participants } = await supabase
             .from("room_participants")
             .select("user_id")
             .eq("room_id", roomId);
          
          if (participants) {
            const dbUserIds = participants.map(p => p.user_id);
            const ghosts = dbUserIds.filter(id => !onlineUserIds.includes(id));
            
            if (ghosts.length > 0) {
              console.log(`👻 Detected ${ghosts.length} ghosts. Cleaning up...`, ghosts);
              ghosts.forEach(ghostId => removeGhostPlayer(roomId, ghostId));
            }
          }
        }
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
