import { useEffect, useState, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Send, Clock, CheckCircle, Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import { leaveGameRoom } from "@/lib/gameUtils";

const HintDrop = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { playerName, isHost, profileId: stateProfileId } = location.state || {};

  const profileId =
    stateProfileId ||
    (roomCode ? localStorage.getItem(`profile_id_${roomCode?.toUpperCase()}`) : null);

  const [hint, setHint] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [room, setRoom] = useState(null);
  const [hintTime, setHintTime] = useState(30);
  const [timeLeft, setTimeLeft] = useState(30);
  const [players, setPlayers] = useState([]);
  const [alivePlayers, setAlivePlayers] = useState([]);
  const [submittedPlayers, setSubmittedPlayers] = useState([]);
  const [isSpectator, setIsSpectator] = useState(false);
  const timerRef = useRef(null);
  const hasHandledTimeUp = useRef(false);
  
  // 🛡️ RACE CONDITION FIX: Guard against multiple transition calls
  const hasMovedToDiscussion = useRef(false);
  
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const serverOffsetRef = useRef(0);

  // Compute "current" isHost status from room data
  const isHostNow = !!(room?.host_id && profileId && room.host_id === profileId);

  useEffect(() => {
    serverOffsetRef.current = serverOffsetMs;
  }, [serverOffsetMs]);

  const syncServerTime = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("server-time", {
        body: {},
      });

      if (error) {
        console.warn("server-time error:", error);
        return;
      }

      const serverIso = data?.serverTime;
      const serverMs = new Date(serverIso).getTime();
      if (!serverIso || Number.isNaN(serverMs)) return;

      setServerOffsetMs(serverMs - Date.now());
    } catch (e) {
      console.warn("server-time invoke failed:", e);
    }
  };

  const getServerNowIso = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("server-time", {
        body: {},
      });
      if (error) throw error;
      if (data?.serverTime) return data.serverTime;
    } catch {
      // fall back
    }
    return new Date().toISOString();
  };

  const computeTimeLeft = (startedAtIso, durationSeconds) => {
    if (!startedAtIso) return durationSeconds;
    const startedAtMs = new Date(startedAtIso).getTime();
    if (Number.isNaN(startedAtMs)) return durationSeconds;
    const nowMs = Date.now() + (serverOffsetRef.current || 0);
    const elapsedSeconds = Math.floor((nowMs - startedAtMs) / 1000);
    return Math.max(0, durationSeconds - elapsedSeconds);
  };

  useEffect(() => {
    syncServerTime();
    const interval = setInterval(() => syncServerTime(), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch room and setup
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Reset guard on load
        hasMovedToDiscussion.current = false;

        if (!profileId) {
          console.error("No profileId found");
          navigate("/");
          return;
        }

        // Get room
        const { data: roomData, error: roomErr } = await supabase
          .from("game_rooms")
          .select("id, room_code, host_id, status, current_round, created_at, settings")
          .eq("room_code", roomCode?.toUpperCase())
          .single();

        if (roomErr || !roomData) {
          navigate("/");
          return;
        }
        setRoom(roomData);
        const time = roomData.settings?.hintTime || 30;
        setHintTime(time);
        setTimeLeft(computeTimeLeft(roomData?.settings?.hintStartedAt, time));

        // Ensure hint phase start is persisted once (host only)
        if (!roomData?.settings?.hintStartedAt && isHost) {
          const startedAt = await getServerNowIso();
          await supabase
            .from("game_rooms")
            .update({
              settings: {
                ...(roomData.settings || {}),
                hintStartedAt: startedAt,
              },
            })
            .eq("id", roomData.id);

          setTimeLeft(computeTimeLeft(startedAt, time));
        }

        // Get participants
        const { data: participants } = await supabase
          .from("room_participants")
          .select("*, profiles!room_participants_user_id_fkey(username)")
          .eq("room_id", roomData.id);

        setPlayers(participants || []);
        
        // Filter to only alive players (spectators don't participate in hints)
        const alive = (participants || []).filter(p => p.is_alive !== false);
        setAlivePlayers(alive);
        
        // Check if current user is a spectator (eliminated)
        const currentParticipant = (participants || []).find(p => p.user_id === profileId);
        if (currentParticipant?.is_alive === false) {
          setIsSpectator(true);
          setSubmitted(true); // Spectators don't need to submit
        }

        // Check if user already submitted hint
        const { data: existingHint } = await supabase
          .from("game_hints")
          .select("*")
          .eq("room_id", roomData.id)
          .eq("user_id", profileId)
          .single();

        if (existingHint) {
          setSubmitted(true);
          setHint(existingHint.hint);
        }

        // Get all submitted hints to show progress
        fetchSubmittedHints(roomData.id);
      } catch (error) {
        console.error("Error:", error);
      }
    };

    fetchData();
  }, [roomCode, navigate, profileId]);

  // Fetch who has submitted hints
  const fetchSubmittedHints = async (roomId) => {
    const { data: hints } = await supabase
      .from("game_hints")
      .select("user_id")
      .eq("room_id", roomId);

    setSubmittedPlayers(hints?.map(h => h.user_id) || []);
  };

  // Real-time subscription for hints and game phase
  useEffect(() => {
    if (!room) return;

    const hintsChannel = supabase
      .channel(`hints_${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_hints",
        },
        () => fetchSubmittedHints(room.id)
      )
      .subscribe();

    const roomChannel = supabase
      .channel(`room_phase_hint_${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_rooms",
        },
        (payload) => {
          if (payload.new?.room_code !== roomCode?.toUpperCase()) return;
          
          // Update room state to reflect new host if changed
          setRoom(payload.new);

          if (payload.new?.status === "discussion") {
            const isHostFromPayload = payload.new.host_id === profileId;
            navigate(`/discussion/${roomCode}`, { state: { playerName, isHost: isHostFromPayload, profileId } });
          }

          const nextHintStartedAt = payload.new?.settings?.hintStartedAt;
          const nextHintTime = payload.new?.settings?.hintTime || hintTime;
          if (nextHintStartedAt) {
            setHintTime(nextHintTime);
            setTimeLeft(computeTimeLeft(nextHintStartedAt, nextHintTime));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(hintsChannel);
      supabase.removeChannel(roomChannel);
    };
  }, [room, roomCode, navigate, playerName, isHost, profileId]);

  // Timer countdown (synced from persisted hintStartedAt)
  useEffect(() => {
    if (!room) return;

    const startedAt = room?.settings?.hintStartedAt;
    if (!startedAt) return;

    hasHandledTimeUp.current = false;

    const tick = () => {
      const next = computeTimeLeft(startedAt, hintTime);
      setTimeLeft(next);
      if (next <= 0 && !hasHandledTimeUp.current) {
        hasHandledTimeUp.current = true;
        handleTimeUp();
      }
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, room?.settings?.hintStartedAt, hintTime]);

  // Check if all alive players submitted
  useEffect(() => {
    if (alivePlayers.length > 0 && submittedPlayers.length >= alivePlayers.length) {
      // All alive players submitted, host can proceed
      if (isHostNow) {
        moveToDiscussion();
      }
    }
  }, [submittedPlayers, alivePlayers, isHostNow]);

  const handleTimeUp = async () => {
    // Auto-submit empty hint if not submitted (and not a spectator)
    if (!submitted && !isSpectator && profileId && room) {
      await supabase.from("game_hints").insert({
        room_id: room.id,
        user_id: profileId,
        hint: hint || "(no hint)",
      });
    }
    
    // Host moves everyone to discussion
    if (isHostNow) {
      setTimeout(() => moveToDiscussion(), 1000);
    }
  };

  const moveToDiscussion = async () => {
    if (!room) return;
    
    // 🛡️ Guard against double submission/transition
    if (hasMovedToDiscussion.current) return;
    hasMovedToDiscussion.current = true;

    const voteSessionStartedAt = await getServerNowIso();
    const { error } = await supabase
      .from("game_rooms")
      .update({
        status: "discussion",
        settings: {
          ...(room.settings || {}),
          voteSessionStartedAt,
        },
      })
      .eq("id", room.id);

    if (error) {
       console.error("Error moving to discussion:", error);
       hasMovedToDiscussion.current = false; // Reset on error
    } else {
      navigate(`/discussion/${roomCode}`, { state: { playerName, isHost: true, profileId } });
    }
  };

  const handleSubmitHint = async () => {
    if (!hint.trim() || !profileId || !room) return;

    const { error } = await supabase.from("game_hints").insert({
      room_id: room.id,
      user_id: profileId,
      hint: hint.trim(),
    });

    if (error) {
      console.error("Error submitting hint:", error);
      return;
    }

    setSubmitted(true);
  };
  
  const handleExitGame = async () => {
    if (room && profileId) {
        await leaveGameRoom(room.id, profileId, isHostNow);
        navigate("/");
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-background gradient-mesh flex items-center justify-center relative">
       {/* Exit Button - Top Left */}
       <div className="absolute top-4 left-4 z-10">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={handleExitGame}
          >
            <ArrowLeft className="w-4 h-4" />
            Exit
          </Button>
        </div>

      <div className="container max-w-lg mx-auto px-4">
        <div className="bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-8 shadow-xl animate-fade-in-up">
          {/* Timer */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <Clock className={`w-6 h-6 ${timeLeft <= 10 ? "text-red-500 animate-pulse" : "text-primary"}`} />
            <span className={`text-3xl font-mono font-bold ${timeLeft <= 10 ? "text-red-500" : "text-primary"}`}>
              {formatTime(timeLeft)}
            </span>
          </div>

          {isSpectator ? (
            <>
              <h1 className="text-2xl font-heading font-bold text-center mb-2">
                👻 Spectator Mode
              </h1>
              <p className="text-muted-foreground text-center mb-8">
                You were eliminated. Watch as others drop their hints.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-heading font-bold text-center mb-2">
                Drop Your Hint
              </h1>
              <p className="text-muted-foreground text-center mb-8">
                Give a one-word hint related to your secret word
              </p>
            </>
          )}

          {/* Hint Input - only show for non-spectators */}
          {!isSpectator && (
            !submitted ? (
              <div className="space-y-4">
                <Input
                  type="text"
                  placeholder="Enter your hint..."
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  className="text-center text-lg py-6 bg-background/50 border-border/40"
                  maxLength={30}
                  disabled={timeLeft <= 0}
                />
                <Button
                  variant="neonCyan"
                  size="lg"
                  className="w-full gap-2"
                  onClick={handleSubmitHint}
                  disabled={!hint.trim() || timeLeft <= 0}
                >
                  <Send className="w-5 h-5" />
                  Submit Hint
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-green-500">
                  <CheckCircle className="w-6 h-6" />
                  <span className="text-lg font-medium">Hint Submitted!</span>
                </div>
                <div className="p-4 rounded-xl bg-muted/50 border border-border/40">
                  <span className="text-xl font-medium">"{hint}"</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Waiting for other players...
                </p>
              </div>
            )
          )}

          {/* Progress */}
          <div className="mt-8 pt-6 border-t border-border/40">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Users className="w-4 h-4" />
              <span>
                {submittedPlayers.length} / {alivePlayers.length} players submitted
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {alivePlayers.map((p) => (
                <div
                  key={p.id}
                  className={`
                    px-3 py-1.5 rounded-full text-sm font-medium transition-all
                    ${submittedPlayers.includes(p.user_id)
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "bg-muted/50 text-muted-foreground border border-border/40"
                    }
                  `}
                >
                  {p.profiles?.username}
                  {submittedPlayers.includes(p.user_id) && (
                    <CheckCircle className="w-3 h-3 inline ml-1" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HintDrop;
