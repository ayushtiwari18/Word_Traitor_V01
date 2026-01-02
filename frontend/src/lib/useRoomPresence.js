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
        // CRITICAL FIX: Any client can trigger this check, not just the host.
        // This ensures if the host disappears, someone else notices and initiates the vote.
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
           // We pass the onlineUserIds so the util knows who is available
           await promoteNewHost(roomId, currentHostId, onlineUserIds);
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
  // CRITICAL FIX: The cleanup logic previously relied on `isHost` being true.
  // But if the host is the one who left, `isHost` is false for everyone else until promotion finishes.
  // This creates a gap where no one cleans up the dead host.
  // NEW LOGIC: We allow ANYONE to run the cleanup check, but inside the interval we check
  // if "I am the host" OR "The host is missing/offline and I am the backup".
  // Actually, simpler: Let's just let the 'sync' event handle host promotion (above),
  // and once promoted, `isHost` becomes true for the new leader, and THEY run the cleanup.
  // The 'sync' event is fast enough for host swaps.
  // The issue seen in screenshots suggests the host promotion didn't fire or wasn't picked up.
  // So we will add a fallback check here: If I am online, and the DB says host is X, but X is not in my `onlineUsersRef`,
  // I should try to promote a new host.
  
  useEffect(() => {
    if (!roomId) return;

    const CLEANUP_INTERVAL_MS = 5000; // Check every 5s
    const OFFLINE_GRACE_MS = 10000;   // Remove after 10s offline

    const intervalId = setInterval(async () => {
      // Safety: Don't clean up if we haven't tracked yet or can't see ourselves
      if (!hasTrackedRef.current) return;
      
      // If I'm not in the online list yet (lag?), wait
      if (!onlineUsersRef.current.includes(profileId)) return;

      try {
        // Fetch DB state
        // We fetch participants AND current host
        const { data: roomData, error: roomErr } = await supabase
            .from("game_rooms")
            .select("host_id")
            .eq("id", roomId)
            .single();

        if (roomErr || !roomData) return;
        
        const dbHostId = roomData.host_id;
        const amIHost = dbHostId === profileId;
        
        // 🚨 FALLBACK HOST PROMOTION 🚨
        // If the DB says Host is X, but X is NOT in our online list for > 5s...
        // And I am the "next in line" (oldest active player), I should trigger promotion.
        // But for simplicity, we can just reuse the promoteNewHost logic which has concurrency checks.
        // Only do this if we see the host is offline.
        if (dbHostId && !onlineUsersRef.current.includes(dbHostId)) {
             console.log("🕵️ Interval: Host appears offline. Checking for promotion...");
             await promoteNewHost(roomId, dbHostId, onlineUsersRef.current);
             // If we successfully promoted ourselves, the next tick `amIHost` will be true.
             return; 
        }

        // 👻 GHOST CLEANUP 👻
        // Only the ACTUAL DB host should perform deletions to avoid race conditions.
        if (!amIHost) return;

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
          
          if (lastSeen > 0) {
            const offlineFor = nowMs - lastSeen;
            if (offlineFor > OFFLINE_GRACE_MS) {
              console.log(`👻 Ghost Cleanup: Removing ${uid} (Offline ${offlineFor}ms)`);
              
              // Call cleanup
              // Note: gameUtils.removeGhostPlayer also checks if ghost was host
              await removeGhostPlayer(roomId, uid);
              
              delete lastSeenOnlineRef.current[uid]; 
            }
          }
        }
      } catch (err) {
        console.error("Ghost cleanup interval error:", err);
      }
    }, CLEANUP_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [roomId, profileId]); // Removed isHost dependency so interval keeps running
};
