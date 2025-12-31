import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { promoteNewHost, removeGhostPlayer } from "@/lib/gameUtils";

/**
 * Custom Hook: Manages Realtime Presence for a game room.
 * - Tracks who is online.
 * - Handles auto-promoting a new host if the current host disconnects.
 * - Allows the Host to cleanup "ghost" players (stale DB participants who are no longer online).
 *
 * NOTE: Ghost cleanup is intentionally conservative (time-based) to avoid accidental removals
 * during initial presence sync.
 *
 * @param {string} roomCode - The room code (e.g. ABCD)
 * @param {string} roomId - The room UUID
 * @param {string} profileId - Current user's ID
 * @param {boolean} isHost - Is the current user the host?
 */
export const useRoomPresence = (roomCode, roomId, profileId, isHost) => {
  const presenceChannelRef = useRef(null);
  const hasTrackedRef = useRef(false);

  // Track last time we saw each user online (from presence).
  // This supports safe "ghost cleanup" with a grace period.
  const lastSeenOnlineRef = useRef({});

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

        const nowMs = Date.now();
        for (const uid of onlineUserIds) {
          lastSeenOnlineRef.current[uid] = nowMs;
        }

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
        if (
          currentHostId &&
          !onlineUserIds.includes(currentHostId) &&
          onlineUserIds.length > 0
        ) {
          console.warn(
            `⚠️ Host ${currentHostId} is offline! Initiating transfer.`
          );

          // 3. ELECTION: Atomic update in gameUtils prevents race conditions.
          promoteNewHost(roomId, currentHostId, onlineUserIds);
        }

        // LOGIC: Ghost Cleanup (CONSERVATIVE)
        // Why: if a user closes the tab / presses back, `leaveGameRoom()` may not run,
        // leaving a stale `room_participants` row. That can block voting (waiting for a vote
        // from someone who is no longer online).
        if (!isHost) return;

        // Only allow cleanup after THIS client has successfully tracked presence.
        // This avoids "1-2 sec" accidental deletions during initial sync.
        if (!hasTrackedRef.current) return;

        // Extra safety: only cleanup once we can see ourselves online.
        if (!onlineUserIds.includes(profileId)) return;

        // Grace period before deleting a missing user.
        const OFFLINE_GRACE_MS = 12000;

        const { data: participants, error: participantsErr } = await supabase
          .from("room_participants")
          .select("user_id")
          .eq("room_id", roomId);

        if (participantsErr) {
          console.warn("⚠️ Ghost cleanup: failed to fetch participants", participantsErr);
          return;
        }

        for (const p of participants || []) {
          const uid = p.user_id;
          if (!uid) continue;

          // Never try to delete self.
          if (uid === profileId) continue;

          // If user is online, skip.
          if (onlineUserIds.includes(uid)) continue;

          const lastSeen = lastSeenOnlineRef.current[uid] || 0;
          const offlineForMs = nowMs - lastSeen;

          // Only remove if we've seen them online before (lastSeen > 0)
          // and they've been missing for longer than the grace period.
          if (lastSeen > 0 && offlineForMs > OFFLINE_GRACE_MS) {
            console.log(`👻 Ghost cleanup: removing ${uid} (offline ${offlineForMs}ms)`);
            await removeGhostPlayer(roomId, uid);
            delete lastSeenOnlineRef.current[uid];
          }
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
  }, [roomCode, roomId, profileId, isHost]);
};
