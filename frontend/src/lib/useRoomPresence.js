import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { promoteNewHost, removeGhostPlayer } from "@/lib/gameUtils";

/**
 * Custom Hook: Manages Realtime Presence for a game room.
 * - Tracks who is online.
 * - Handles auto-promoting a new host if the current host disconnects.
 * - Allows the Host to cleanup "ghost" players using a polling interval.
 * 
 * @param {string} roomCode - The room code (e.g. ABCD)
 * @param {string} roomId - The room UUID
 * @param {string} profileId - Current user's ID
 * @param {boolean} isHost - Is the current user the host?
 */
export const useRoomPresence = (roomCode, roomId, profileId, isHost) => {
  const presenceChannelRef = useRef(null);
  const hasTrackedRef = useRef(false);

  // Store online users ref for access inside interval
  const onlineUsersRef = useRef([]);
  // Track last time we saw each user online
  const lastSeenOnlineRef = useRef({});

  // 1. Setup Presence Channel & Listeners
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

        // Update Refs
        onlineUsersRef.current = onlineUserIds;
        const nowMs = Date.now();
        for (const uid of onlineUserIds) {
          lastSeenOnlineRef.current[uid] = nowMs;
        }

        // LOGIC: Host Transfer (Immediate Trigger)
        // This works fine in 'sync' because it's an immediate reaction to a change
        const { data: roomData } = await supabase
          .from("game_rooms")
          .select("host_id")
          .eq("id", roomId)
          .single();

        const currentHostId = roomData?.host_id;

        if (
          currentHostId &&
          !onlineUserIds.includes(currentHostId) &&
          onlineUserIds.length > 0
        ) {
          console.warn(`⚠️ Host ${currentHostId} is offline! Initiating transfer.`);
          promoteNewHost(roomId, currentHostId, onlineUserIds);
        }
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
  }, [roomCode, roomId, profileId]); // Removed isHost dep to avoid re-subscribing

  // 2. Setup Ghost Cleanup Interval
  // We use a separate interval because "sync" only fires ONCE when a user leaves.
  // We need to wait for the grace period to expire, which requires periodic checking.
  useEffect(() => {
    if (!isHost || !roomId) return;

    const CLEANUP_INTERVAL_MS = 5000; // Check every 5s
    const OFFLINE_GRACE_MS = 10000;   // Remove after 10s offline

    const intervalId = setInterval(async () => {
      // Safety: Don't clean up if we haven't tracked yet or can't see ourselves
      if (!hasTrackedRef.current) return;
      if (!onlineUsersRef.current.includes(profileId)) return;

      try {
        // Fetch DB state
        const { data: participants, error } = await supabase
          .from("room_participants")
          .select("user_id")
          .eq("room_id", roomId);

        if (error || !participants) return;

        const nowMs = Date.now();

        for (const p of participants) {
          const uid = p.user_id;
          if (!uid || uid === profileId) continue; // Skip self

          // If currently online, skip
          if (onlineUsersRef.current.includes(uid)) continue;

          // If user is missing from presence, check how long
          const lastSeen = lastSeenOnlineRef.current[uid] || 0;
          
          // If we never saw them (joined before us?), assume they are just gone
          // But to be safe, we use the timestamp of when WE started tracking as a baseline
          // Actually, 'lastSeen' being 0 means we haven't seen them since WE joined.
          // If we just joined, we shouldn't delete immediately.
          // Simple heuristic: we only delete if we HAVE seen them (lastSeen > 0)
          // OR if we've been running for a while. 
          // For simplicity/safety: only delete if lastSeen > 0.
          if (lastSeen > 0) {
            const offlineFor = nowMs - lastSeen;
            if (offlineFor > OFFLINE_GRACE_MS) {
              console.log(`👻 Ghost Cleanup: Removing ${uid} (Offline ${offlineFor}ms)`);
              await removeGhostPlayer(roomId, uid);
              // Clear from ref so we don't try again immediately (though DB delete handles it)
              delete lastSeenOnlineRef.current[uid]; 
            }
          }
        }
      } catch (err) {
        console.error("Ghost cleanup interval error:", err);
      }
    }, CLEANUP_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isHost, roomId, profileId]);
};
