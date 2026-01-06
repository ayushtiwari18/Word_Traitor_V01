import { useEffect, useRef, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
  MessageCircle,
  Send,
  Clock,
  Users,
  Vote,
  CheckCircle,
  XCircle,
  Trophy,
  Skull,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import { leaveGameRoom } from "@/lib/gameUtils";
import { useRoomPresence } from "@/lib/useRoomPresence";
import { cn } from "@/lib/utils";

const Discussion = () => {
  const VOTE_DURATION_SECONDS = 120;

  const { roomCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { playerName, isHost, profileId: stateProfileId } = location.state || {};

  const profileId =
    stateProfileId ||
    (roomCode
      ? localStorage.getItem(`profile_id_${roomCode?.toUpperCase()}`)
      : null);

  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [hints, setHints] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [timeLeft, setTimeLeft] = useState(VOTE_DURATION_SECONDS);

  const [myVote, setMyVote] = useState(null);
  const [votes, setVotes] = useState([]);
  const [votingComplete, setVotingComplete] = useState(false);
  const [votedPlayer, setVotedPlayer] = useState(null);
  const [traitorId, setTraitorId] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [eliminatedPlayers, setEliminatedPlayers] = useState([]);
  const [voteSession, setVoteSession] = useState(1);
  const [gameResult, setGameResult] = useState(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  // Mobile-only UI state
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [hintsExpanded, setHintsExpanded] = useState(true);

  const voteSessionRef = useRef(1);
  const lastVoteSessionRef = useRef(null);
  const endingInProgressRef = useRef(false);
  const serverOffsetRef = useRef(0);
  const hasHandledTimeUp = useRef(false);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    voteSessionRef.current = voteSession;
  }, [voteSession]);

  useEffect(() => {
    serverOffsetRef.current = serverOffsetMs;
  }, [serverOffsetMs]);

  const isHostNow = !!(room?.host_id && profileId && room.host_id === profileId);

  // 📡 PRESENCE HOOK
  useRoomPresence(roomCode, room?.id, profileId, isHostNow);

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

      const offset = serverMs - Date.now();
      setServerOffsetMs(offset);
    } catch (e) {
      console.warn("server-time invoke failed:", e);
    }
  };

  useEffect(() => {
    syncServerTime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const computeTimeLeft = (startedAtIso) => {
    if (!startedAtIso) return VOTE_DURATION_SECONDS;
    const startedAtMs = new Date(startedAtIso).getTime();
    if (Number.isNaN(startedAtMs)) return VOTE_DURATION_SECONDS;
    const nowMs = Date.now() + (serverOffsetRef.current || 0);
    const elapsedSeconds = Math.floor((nowMs - startedAtMs) / 1000);
    return Math.max(0, VOTE_DURATION_SECONDS - elapsedSeconds);
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

  const ensureVoteSessionStartedAt = async (
    roomData,
    session,
    isHostFromRoomData
  ) => {
    if (!roomData?.id) return;
    if (!isHostFromRoomData) return;
    if (roomData?.settings?.voteSessionStartedAt) return;

    try {
      const startedAt = await getServerNowIso();
      await supabase
        .from("game_rooms")
        .update({
          settings: {
            ...(roomData.settings || {}),
            voteSession: session ?? 1,
            voteSessionStartedAt: startedAt,
          },
        })
        .eq("id", roomData.id);
    } catch (error) {
      console.error("Error setting voteSessionStartedAt:", error);
    }
  };

  const endGame = async (result) => {
    if (!room || !isHostNow || endingInProgressRef.current) return;

    try {
      endingInProgressRef.current = true;
      const nextSettings = {
        ...(room.settings || {}),
        gameResult: result,
      };

      await supabase
        .from("game_rooms")
        .update({ status: "finished", settings: nextSettings })
        .eq("id", room.id);

      setGameResult(result);
    } catch (error) {
      console.error("Error ending game:", error);
    } finally {
      // keep true to avoid repeated writes
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!profileId) {
          console.error("No profileId found");
          navigate("/");
          return;
        }

        const { data: roomData } = await supabase
          .from("game_rooms")
          .select(
            "id, room_code, host_id, status, current_round, created_at, settings"
          )
          .eq("room_code", roomCode?.toUpperCase())
          .single();

        if (!roomData) {
          navigate("/");
          return;
        }
        setRoom(roomData);

        const isHostFromRoomData = !!(
          roomData.host_id &&
          profileId &&
          roomData.host_id === profileId
        );

        const nextVoteSession = roomData?.settings?.voteSession ?? 1;
        setVoteSession(nextVoteSession);
        if (roomData?.settings?.gameResult) {
          setGameResult(roomData.settings.gameResult);
        }

        // Restore timer from persisted start time
        setTimeLeft(computeTimeLeft(roomData?.settings?.voteSessionStartedAt));

        // Ensure there's a start time persisted once (host only)
        await ensureVoteSessionStartedAt(roomData, nextVoteSession, isHostFromRoomData);

        const { data: participants } = await supabase
          .from("room_participants")
          .select("*, profiles!room_participants_user_id_fkey(username)")
          .eq("room_id", roomData.id);

        setPlayers(participants || []);

        const currentParticipant = participants?.find((p) => p.user_id === profileId);
        if (currentParticipant?.is_alive === false) {
          setIsSpectator(true);
        }

        const eliminated = participants?.filter((p) => p.is_alive === false) || [];
        setEliminatedPlayers(eliminated.map((p) => p.user_id));

        const { data: hintsData } = await supabase
          .from("game_hints")
          .select("*")
          .eq("room_id", roomData.id);

        if (hintsData && hintsData.length > 0) {
          const userIds = [
            ...new Set(hintsData.map((h) => h.user_id).filter(Boolean)),
          ];
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, username")
            .in("id", userIds);

          const profileMap = {};
          profilesData?.forEach((p) => {
            profileMap[p.id] = p.username;
          });

          const hintsWithNames = hintsData.map((h) => ({
            ...h,
            username: profileMap[h.user_id] || "Unknown",
          }));
          setHints(hintsWithNames);
        } else {
          setHints([]);
        }

        const { data: secretsData } = await supabase
          .from("room_participants")
          .select("user_id, role")
          .eq("room_id", roomData.id)
          .eq("role", "traitor");

        const traitor = secretsData?.[0];
        if (traitor) {
          setTraitorId(traitor.user_id);
        }

        if (
          lastVoteSessionRef.current !== null &&
          lastVoteSessionRef.current !== nextVoteSession
        ) {
          setVotes([]);
          setMyVote(null);
          setVotingComplete(false);
          setShowResults(false);
          setVotedPlayer(null);
          hasHandledTimeUp.current = false; // Reset handler on new session
          setTimeLeft(computeTimeLeft(roomData?.settings?.voteSessionStartedAt));
        }
        lastVoteSessionRef.current = nextVoteSession;

        await fetchVotes(roomData.id, nextVoteSession);
        fetchMessages(roomData.id);
      } catch (error) {
        console.error("Error:", error);
      }
    };

    fetchData();
  }, [roomCode, navigate, profileId]);

  const fetchVotes = async (roomId, session = voteSessionRef.current) => {
    const { data: votesData } = await supabase
      .from("game_votes")
      .select("*")
      .eq("room_id", roomId)
      .eq("round_number", session);

    setVotes(votesData || []);

    const myExistingVote = (votesData || []).find((v) => v.voter_id === profileId);
    if (myExistingVote) {
      setMyVote(myExistingVote.voted_user_id);
    }
  };

  const fetchMessages = async (roomId) => {
    const { data: messagesData } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (messagesData && messagesData.length > 0) {
      const userIds = [...new Set(messagesData.map((m) => m.user_id).filter(Boolean))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds);

      const profileMap = {};
      profilesData?.forEach((p) => {
        profileMap[p.id] = p.username;
      });

      const messagesWithNames = messagesData.map((m) => ({
        ...m,
        username: profileMap[m.user_id] || "Unknown",
      }));
      setMessages(messagesWithNames);

      // Scroll within chat containers (works for both desktop and mobile since ref is inside each view)
      setTimeout(
        () => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        50
      );
    } else {
      setMessages([]);
    }
  };

  // ✅ VOTE TALLY & ELIMINATION LOGIC
  useEffect(() => {
    if (!room || !players.length) return;

    const activePlayers = players.filter((p) => p.is_alive !== false);
    const totalActivePlayers = activePlayers.length;
    const totalVotes = votes.length;

    if (
      ((totalVotes >= totalActivePlayers && totalActivePlayers > 0) ||
        (timeLeft <= 0 && isHostNow)) &&
      !votingComplete
    ) {
      const voteCounts = {};
      votes.forEach((v) => {
        voteCounts[v.voted_user_id] = (voteCounts[v.voted_user_id] || 0) + 1;
      });

      let maxVotes = 0;
      Object.values(voteCounts).forEach((count) => {
        if (count > maxVotes) maxVotes = count;
      });

      let eliminatedUserId = null;

      if (maxVotes === 0) {
        console.log("⏰ Time up with 0 votes. Skipping elimination.");
        if (activePlayers.length > 0 && isHostNow) {
          const randomIdx = Math.floor(Math.random() * activePlayers.length);
          eliminatedUserId = activePlayers[randomIdx].user_id;
          console.log("🎲 Time up! Randomly eliminating:", eliminatedUserId);
        }
      } else {
        const topCandidates = Object.keys(voteCounts).filter(
          (id) => voteCounts[id] === maxVotes
        );

        if (topCandidates.length === 1) {
          eliminatedUserId = topCandidates[0];
        } else {
          const randomIndex = Math.floor(Math.random() * topCandidates.length);
          eliminatedUserId = topCandidates[randomIndex];
          console.log("🎲 Tie detected! Randomly eliminating:", eliminatedUserId);
        }
      }

      if (eliminatedUserId) {
        const votedPlayerData = players.find((p) => p.user_id === eliminatedUserId);
        setVotedPlayer(votedPlayerData);
        setVotingComplete(true);
        setShowResults(true);
        setShowVoteModal(false);

        if (votedPlayerData?.user_id && votedPlayerData.user_id === traitorId && isHostNow) {
          endGame({
            winner: "citizens",
            reason: "traitor_voted_out",
            traitorId,
            votedOutId: votedPlayerData.user_id,
            voteSession: voteSessionRef.current,
          });
        }
      }
    }
  }, [votes, players, room, votingComplete, traitorId, timeLeft, isHostNow]);

  // ✅ GAME OVER LOGIC (2 Players Left)
  useEffect(() => {
    if (!room || !traitorId || !players.length) return;
    if (!isHostNow) return;
    if (room.status === "finished") return;

    const alivePlayers = players.filter((p) => p.is_alive !== false);
    const traitorAlive = alivePlayers.some((p) => p.user_id === traitorId);

    if (alivePlayers.length === 2) {
      if (traitorAlive) {
        endGame({ winner: "traitor", reason: "two_players_left", traitorId });
      } else {
        endGame({ winner: "citizens", reason: "all_citizens_remain", traitorId });
      }
    }

    if (alivePlayers.length === 1) {
      if (traitorAlive) {
        endGame({ winner: "traitor", reason: "only_traitor_remains", traitorId });
      } else {
        endGame({ winner: "citizens", reason: "only_citizen_remains", traitorId });
      }
    }
  }, [players, traitorId, room, isHostNow]);

  useEffect(() => {
    if (!room) return;

    const messagesChannel = supabase
      .channel(`chat_${roomCode}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => fetchMessages(room.id)
      )
      .subscribe();

    const votesChannel = supabase
      .channel(`votes_${roomCode}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_votes" },
        () => fetchVotes(room.id, voteSessionRef.current)
      )
      .subscribe();

    const roomChannel = supabase
      .channel(`room_status_${roomCode}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_rooms" },
        (payload) => {
          if (payload.new?.room_code !== roomCode?.toUpperCase()) return;

          setRoom((prev) => ({ ...(prev || {}), ...payload.new }));

          if (payload.new?.status === "waiting") {
            navigate(`/lobby/${roomCode}`, {
              state: {
                playerName,
                isHost: payload.new?.host_id === profileId,
                profileId,
              },
            });
          }

          if (payload.new?.status === "hint_drop") {
            const isHostFromPayload = payload.new?.host_id === profileId;
            navigate(`/hint/${roomCode}`, {
              state: { playerName, isHost: isHostFromPayload, profileId },
            });
          }

          if (payload.new?.status === "finished") {
            if (payload.new?.settings?.gameResult) {
              setGameResult(payload.new.settings.gameResult);
            }
          }

          if (payload.new?.settings?.voteSession) {
            setVoteSession(payload.new.settings.voteSession);
          }

          if (payload.new?.settings?.voteSessionStartedAt) {
            setTimeLeft(computeTimeLeft(payload.new.settings.voteSessionStartedAt));
          }
        }
      )
      .subscribe();

    const participantsChannel = supabase
      .channel(`participants_${roomCode}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_participants" },
        async () => {
          const { data: participants } = await supabase
            .from("room_participants")
            .select("*, profiles!room_participants_user_id_fkey(username)")
            .eq("room_id", room.id);

          setPlayers(participants || []);

          const currentParticipant = participants?.find((p) => p.user_id === profileId);
          if (currentParticipant?.is_alive === false) {
            setIsSpectator(true);
          }

          const eliminated = participants?.filter((p) => p.is_alive === false) || [];
          setEliminatedPlayers(eliminated.map((p) => p.user_id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(votesChannel);
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(participantsChannel);
    };
  }, [room, roomCode, navigate, playerName, profileId]);

  // FIX: Accurate Timer Sync
  useEffect(() => {
    if (!room?.settings?.voteSessionStartedAt || votingComplete) return;

    const tick = () => {
      const remaining = computeTimeLeft(room.settings.voteSessionStartedAt);
      setTimeLeft(remaining);

      if (remaining <= 0 && isHostNow && !votingComplete && !hasHandledTimeUp.current) {
        hasHandledTimeUp.current = true;
      }
    };

    tick();
    const timer = setInterval(tick, 1000);

    return () => clearInterval(timer);
  }, [room?.settings?.voteSessionStartedAt, votingComplete, isHostNow]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !profileId || !room) return;

    await supabase.from("chat_messages").insert({
      room_id: room.id,
      user_id: profileId,
      message: newMessage.trim(),
    });

    setNewMessage("");
  };

  const handleVote = async (votedForId) => {
    if (!profileId || !room || myVote || votingComplete || isSpectator) return;

    const { error } = await supabase.from("game_votes").insert({
      room_id: room.id,
      voter_id: profileId,
      voted_user_id: votedForId,
      round_number: voteSessionRef.current,
    });

    if (!error) {
      setMyVote(votedForId);
      setShowVoteModal(false);
    }
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

  const getPlayerName = (odId) => {
    const player = players.find((p) => p.user_id === odId);
    return player?.profiles?.username || "Unknown";
  };

  const getVoteCount = (playerId) => votes.filter((v) => v.voted_user_id === playerId).length;

  const isTraitor = votedPlayer?.user_id === traitorId;

  const handleBackToLobby = async () => {
    if (!room) return;
    try {
      await supabase.from("game_votes").delete().eq("room_id", room.id);
      await supabase.from("game_hints").delete().eq("room_id", room.id);
      await supabase.from("chat_messages").delete().eq("room_id", room.id);
      await supabase.from("round_secrets").delete().eq("room_id", room.id);
      await supabase.from("room_participants").update({ is_alive: true }).eq("room_id", room.id);
      await supabase
        .from("game_rooms")
        .update({
          status: "waiting",
          current_round: 1,
          settings: {
            ...(room.settings || {}),
            voteSession: 1,
            gameResult: null,
            voteSessionStartedAt: null,
            wordRevealStartedAt: null,
            hintStartedAt: null,
          },
        })
        .eq("id", room.id);

      navigate(`/lobby/${roomCode}`, {
        state: { playerName, isHost: room.host_id === profileId, profileId },
      });
    } catch (error) {
      console.error("Error returning to lobby:", error);
    }
  };

  const handleContinueGame = async () => {
    if (!room || !votedPlayer) return;
    if (!isHostNow) return;

    try {
      await supabase
        .from("room_participants")
        .update({ is_alive: false })
        .eq("room_id", room.id)
        .eq("user_id", votedPlayer.user_id);

      const { data: updatedParticipants } = await supabase
        .from("room_participants")
        .select("user_id, is_alive, role")
        .eq("room_id", room.id);

      const alivePlayers = (updatedParticipants || []).filter((p) => p.is_alive !== false);
      const traitorAlive = alivePlayers.some((p) => p.user_id === traitorId || p.role === "traitor");

      if (alivePlayers.length === 2) {
        if (traitorAlive) {
          await endGame({ winner: "traitor", reason: "two_players_left", traitorId });
        } else {
          await endGame({ winner: "citizens", reason: "all_citizens_remain", traitorId });
        }
        return;
      }

      if (alivePlayers.length === 1) {
        if (traitorAlive) {
          await endGame({ winner: "traitor", reason: "only_traitor_remains", traitorId });
        } else {
          await endGame({ winner: "citizens", reason: "only_citizen_remains", traitorId });
        }
        return;
      }

      await supabase.from("game_hints").delete().eq("room_id", room.id);
      await supabase
        .from("game_votes")
        .delete()
        .eq("room_id", room.id)
        .eq("round_number", voteSessionRef.current);

      const nextSession = (voteSessionRef.current || 1) + 1;
      const hintStartedAt = await getServerNowIso();

      await supabase
        .from("game_rooms")
        .update({
          status: "hint_drop",
          settings: {
            ...(room.settings || {}),
            voteSession: nextSession,
            hintRound: nextSession,
            hintStartedAt,
            voteSessionStartedAt: null,
          },
        })
        .eq("id", room.id);

      navigate(`/hint/${roomCode}`, { state: { playerName, isHost: true, profileId } });
    } catch (error) {
      console.error("Error continuing game:", error);
    }
  };

  // 🏁 GAME OVER SCREEN (Mobile + Desktop)
  if (gameResult?.winner) {
    const traitorName = traitorId ? getPlayerName(traitorId) : "Unknown";
    const citizensWon = gameResult.winner === "citizens";

    return (
      <div className="min-h-screen bg-background gradient-mesh flex items-center justify-center relative lg:p-0">
        
        {/* Desktop Container */}
        <div className="hidden lg:block absolute top-4 left-4 z-10">
          <Button variant="ghost" size="sm" className="gap-2" onClick={handleExitGame}>
            <ArrowLeft className="w-4 h-4" /> Exit
          </Button>
        </div>

        <div className={cn(
            "bg-card/40 backdrop-blur-md border border-border/40 shadow-xl animate-fade-in-up text-center",
            // Desktop: Centered card
            "lg:rounded-2xl lg:p-8 lg:max-w-lg lg:w-full lg:relative",
            // Mobile: Full-width bottom sheet style (or full screen center) - let's go with full screen center for Game Over
            "w-full h-full flex flex-col justify-center items-center p-6 lg:h-auto"
        )}>
            <div
              className={`w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center ${
                citizensWon
                  ? "bg-green-500/20 border-4 border-green-500"
                  : "bg-red-500/20 border-4 border-red-500"
              }`}
            >
              {citizensWon ? (
                <Trophy className="w-12 h-12 text-green-500" />
              ) : (
                <Skull className="w-12 h-12 text-red-500" />
              )}
            </div>

            <h1 className="text-4xl font-heading font-bold mb-3">
              {citizensWon ? "Citizens Win!" : "Traitor Wins!"}
            </h1>

            <p className="text-muted-foreground mb-8 text-lg px-4">
              {gameResult.reason === "traitor_voted_out" && "The traitor has been eliminated."}
              {gameResult.reason === "two_players_left" && "Only two players remain. The traitor escapes."}
              {gameResult.reason === "all_citizens_remain" && "Only citizens remain. The traitor was eliminated!"}
              {gameResult.reason === "only_traitor_remains" && "The traitor outlasted everyone!"}
              {gameResult.reason === "only_citizen_remains" && "The last citizen standing wins!"}
            </p>

            <div className="bg-background/50 rounded-xl p-6 mb-8 w-full max-w-sm mx-auto">
              <h3 className="text-lg font-bold mb-2 uppercase tracking-widest text-muted-foreground">Traitor Identity</h3>
              <p className="text-3xl font-heading font-bold text-secondary">{traitorName}</p>
            </div>

            <Button 
                variant="neonCyan" 
                size="lg" 
                className="w-full max-w-sm h-14 text-lg"
                onClick={handleBackToLobby} 
                disabled={!isHostNow}
            >
              {isHostNow ? "Back to Lobby" : "Waiting for host..."}
            </Button>
            
            <div className="lg:hidden mt-8">
                <Button variant="ghost" size="sm" onClick={handleExitGame} className="text-muted-foreground">
                    Exit Game
                </Button>
            </div>
        </div>
      </div>
    );
  }

  // 🗳️ ROUND RESULTS SCREEN (Mobile + Desktop)
  if (showResults && votedPlayer) {
    return (
      <div className="min-h-screen bg-background gradient-mesh flex items-end lg:items-center justify-center relative">
        
        {/* Desktop Exit Button */}
        <div className="hidden lg:block absolute top-4 left-4 z-10">
          <Button variant="ghost" size="sm" className="gap-2" onClick={handleExitGame}>
            <ArrowLeft className="w-4 h-4" /> Exit
          </Button>
        </div>

        <div className={cn(
             "bg-card/95 backdrop-blur-xl border-t lg:border border-border/40 shadow-2xl animate-slide-up-mobile lg:animate-fade-in-up text-center",
             // Desktop styles
             "lg:rounded-2xl lg:p-8 lg:max-w-lg lg:w-full lg:relative lg:h-auto",
             // Mobile styles (Bottom Sheet)
             "w-full rounded-t-3xl p-6 pb-10 fixed bottom-0 left-0 right-0 max-h-[90vh] overflow-y-auto"
        )}>
            {/* Mobile Drag Handle (Visual) */}
            <div className="lg:hidden w-12 h-1.5 bg-border/50 rounded-full mx-auto mb-6" />

            <div
              className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center animate-bounce-in ${
                isTraitor
                  ? "bg-green-500/20 border-2 border-green-500"
                  : "bg-red-500/20 border-2 border-red-500"
              }`}
            >
              {isTraitor ? (
                <Trophy className="w-10 h-10 text-green-500" />
              ) : (
                <Skull className="w-10 h-10 text-red-500" />
              )}
            </div>

            <h1 className="text-3xl font-heading font-bold mb-2">
              {votedPlayer.profiles?.username}
            </h1>
            <p className="text-muted-foreground mb-6">was voted out!</p>

            <div className={`text-xl font-bold mb-8 ${isTraitor ? "text-green-500" : "text-red-500"}`}>
              {isTraitor ? (
                <span className="flex items-center justify-center gap-2 animate-pulse">
                  <CheckCircle className="w-6 h-6" />
                  TRAITOR ELIMINATED!
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <XCircle className="w-6 h-6" />
                  INNOCENT ELIMINATED!
                </span>
              )}
            </div>

            <div className="bg-background/50 rounded-xl p-4 mb-6 text-left max-h-40 overflow-y-auto">
              <h3 className="text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wider">Vote Breakdown</h3>
              <div className="space-y-2">
                {players.map((p) => (
                  <div key={p.user_id} className="flex items-center justify-between text-sm">
                    <span className={p.is_alive === false ? "line-through opacity-50" : ""}>
                      {p.profiles?.username}
                    </span>
                    <span className="font-mono bg-muted px-2 py-0.5 rounded text-xs">{getVoteCount(p.user_id)}</span>
                  </div>
                ))}
              </div>
            </div>

            {isTraitor ? (
              <Button variant="neonCyan" size="lg" className="w-full h-12" onClick={handleBackToLobby}>
                  Back to Lobby
              </Button>
            ) : (
              <div className="space-y-3">
                <Button variant="neonCyan" size="lg" className="w-full h-12" onClick={handleContinueGame} disabled={!isHostNow}>
                  {isHostNow ? "Next Round" : "Waiting for Host..."}
                </Button>
                {!isTraitor && (
                    <p className="text-xs text-muted-foreground">
                        The traitor is still among us...
                    </p>
                )}
              </div>
            )}
            
            <div className="lg:hidden mt-6">
                 <Button variant="ghost" size="sm" onClick={handleExitGame} className="text-muted-foreground w-full">
                    Exit Game
                </Button>
            </div>
        </div>
      </div>
    );
  }

  // ... (Rest of Mobile / Desktop Layout logic remains unchanged from previous step)
  return (
    <div className="min-h-screen bg-background gradient-mesh relative">
      {/* MOBILE VIEW (new) */}
      <div className="lg:hidden min-h-[100dvh] flex flex-col overflow-hidden">
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/40 px-4 py-3 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -ml-2"
              onClick={handleExitGame}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div
              className="flex items-center gap-1 text-sm font-medium cursor-pointer select-none"
              onClick={() => setHintsExpanded(!hintsExpanded)}
            >
              <Users className="w-4 h-4 text-secondary" />
              Hints
              {hintsExpanded ? (
                <ChevronUp className="w-3 h-3 opacity-50" />
              ) : (
                <ChevronDown className="w-3 h-3 opacity-50" />
              )}
            </div>
          </div>

          <div
            className={cn(
              "flex items-center gap-1.5 font-mono text-lg font-bold",
              timeLeft <= 30 ? "text-red-500 animate-pulse" : "text-primary"
            )}
          >
            <Clock className="w-4 h-4" />
            {formatTime(timeLeft)}
          </div>
        </div>

        {hintsExpanded && (
          <div className="bg-muted/30 border-b border-border/40 max-h-40 overflow-y-auto shrink-0 p-2">
            <div className="flex gap-2 overflow-x-auto pb-2 px-1 snap-x">
              {hints.map((h, i) => (
                <div
                  key={h.id || i}
                  className="flex-none w-40 p-2.5 rounded-lg bg-card border border-border/40 shadow-sm snap-start"
                >
                  <div className="text-xs text-muted-foreground truncate font-semibold mb-1">
                    {h.username}
                  </div>
                  <div className="text-sm font-medium text-primary truncate">"{h.hint}"</div>
                </div>
              ))}
              {hints.length === 0 && (
                <span className="text-xs text-muted-foreground p-2">No hints available.</span>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground/50 mt-10 text-sm">
              Start the discussion...
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={msg.id || i}
              className={cn("flex flex-col", msg.user_id === profileId ? "items-end" : "items-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                  msg.user_id === profileId
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-card border border-border/50 rounded-bl-none"
                )}
              >
                {msg.message}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 px-1">
                {msg.user_id === profileId ? "You" : msg.username || "Unknown"}
              </span>
            </div>
          ))}
          <div ref={chatBottomRef} />
        </div>

        <div
          className="shrink-0 p-3 bg-background border-t border-border/40 flex items-center gap-2"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <Input
            placeholder="Type message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            className="flex-1 bg-muted/40 border-0 focus-visible:ring-1 focus-visible:ring-primary rounded-full h-10 px-4"
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={handleSendMessage}
            className={cn(
              "h-10 w-10 rounded-full",
              newMessage.trim() ? "text-primary" : "text-muted-foreground"
            )}
            disabled={!newMessage.trim()}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>

        {!isSpectator && !myVote && (
          <div className="absolute bottom-20 right-4 z-30">
            <Button
              onClick={() => setShowVoteModal(true)}
              className="rounded-full h-14 px-6 shadow-xl bg-red-500 hover:bg-red-600 text-white font-bold gap-2"
            >
              <Vote className="w-5 h-5" /> Vote Now
            </Button>
          </div>
        )}

        {myVote && (
          <div className="absolute top-14 left-0 right-0 z-20 flex justify-center pointer-events-none">
            <div className="bg-green-500/90 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg backdrop-blur-sm">
              Vote Cast
            </div>
          </div>
        )}

        {showVoteModal && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end justify-center p-4">
            <div className="bg-card w-full max-w-sm rounded-t-2xl border border-border shadow-2xl p-6 flex flex-col max-h-[80vh]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-heading font-bold flex items-center gap-2">
                  <Vote className="w-5 h-5 text-red-500" /> Cast Vote
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setShowVoteModal(false)}>
                  <XCircle className="w-6 h-6 text-muted-foreground" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                {players
                  .filter((p) => p.user_id !== profileId && p.is_alive !== false)
                  .map((p) => (
                    <Button
                      key={p.user_id}
                      variant="outline"
                      className="w-full justify-between h-12 text-base hover:bg-red-500/10 hover:border-red-500 hover:text-red-500 transition-all"
                      onClick={() => handleVote(p.user_id)}
                    >
                      {p.profiles?.username}
                    </Button>
                  ))}

                {players.filter((p) => p.user_id !== profileId && p.is_alive !== false).length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    No valid players to vote for.
                  </p>
                )}

                {isSpectator && (
                  <p className="text-center text-muted-foreground py-2">
                    You are a spectator and cannot vote.
                  </p>
                )}
              </div>
              <p className="text-center text-xs text-muted-foreground mt-4">
                Vote carefully. You cannot change it.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* DESKTOP / LAPTOP VIEW (old) */}
      <div className="hidden lg:block">
        <div className="absolute top-4 left-4 z-10">
          <Button variant="ghost" size="sm" className="gap-2" onClick={handleExitGame}>
            <ArrowLeft className="w-4 h-4" />
            Exit
          </Button>
        </div>

        <div className="container max-w-4xl mx-auto px-4 py-6 pt-16">
          <div className="flex items-center justify-between mb-6 animate-fade-in-up">
            <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-primary" />
              Discussion & Vote
            </h1>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/50 border border-border/40">
              <Clock className={`w-5 h-5 ${timeLeft <= 30 ? "text-red-500" : "text-primary"}`} />
              <span className={`font-mono text-lg ${timeLeft <= 30 ? "text-red-500" : ""}`}>
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4 animate-fade-in-up">
              <div className="bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-4">
                <h2 className="text-lg font-heading font-bold mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-secondary" />
                  Player Hints
                </h2>
                <div className="space-y-3">
                  {hints.map((h, i) => (
                    <div
                      key={h.id || i}
                      className="p-3 rounded-xl bg-background/50 border border-border/40"
                    >
                      <div className="text-sm text-muted-foreground mb-1">{h.username}</div>
                      <div className="text-lg font-medium text-primary">"{h.hint}"</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4 animate-fade-in-up">
              <div className="bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-4 h-[350px] flex flex-col">
                <h2 className="text-lg font-heading font-bold mb-4">Discuss & Debate</h2>

                <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
                  {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No messages yet. Start the discussion!
                    </div>
                  ) : (
                    messages.map((msg, i) => (
                      <div
                        key={msg.id || i}
                        className={`p-3 rounded-xl ${
                          msg.user_id === profileId
                            ? "bg-primary/20 border border-primary/30 ml-8"
                            : "bg-muted/50 border border-border/40 mr-8"
                        }`}
                      >
                        <div className="text-xs text-muted-foreground mb-1">
                          {msg.username || getPlayerName(msg.user_id)}
                        </div>
                        <div className="text-sm">{msg.message}</div>
                      </div>
                    ))
                  )}
                  <div ref={chatBottomRef} />
                </div>

                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    className="flex-1 bg-background/50 border-border/40"
                  />
                  <Button
                    variant="neonCyan"
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                  >
                    <Send className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              <div className="bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-4">
                <h2 className="text-lg font-heading font-bold mb-4 flex items-center gap-2">
                  <Vote className="w-5 h-5 text-secondary" />
                  Vote for the Traitor
                  <span className="ml-auto text-sm font-normal text-muted-foreground">
                    {votes.length}/{players.filter((p) => p.is_alive !== false).length} voted
                  </span>
                </h2>

                {isSpectator ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <XCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                    <p className="font-bold text-red-400">You were eliminated</p>
                    <p className="text-sm mt-2">You are now a spectator and cannot vote.</p>
                  </div>
                ) : myVote ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                    You voted for <span className="font-bold text-primary">{getPlayerName(myVote)}</span>
                    <p className="text-sm mt-2">Waiting for others to vote...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {players
                      .filter((p) => p.user_id !== profileId && p.is_alive !== false)
                      .map((p) => (
                        <Button
                          key={p.user_id}
                          variant="outline"
                          className="h-auto py-3 flex flex-col items-center gap-1 hover:bg-red-500/20 hover:border-red-500/50"
                          onClick={() => handleVote(p.user_id)}
                          disabled={!!myVote || isSpectator}
                        >
                          <span className="font-bold">{p.profiles?.username}</span>
                          <span className="text-xs text-muted-foreground">{getVoteCount(p.user_id)} votes</span>
                        </Button>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Discussion;
