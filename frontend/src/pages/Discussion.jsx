import { useEffect, useRef, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { MessageCircle, Send, Clock, Users, Vote, CheckCircle, XCircle, Trophy, Skull, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import { leaveGameRoom } from "@/lib/gameUtils";
import { useRoomPresence } from "@/lib/useRoomPresence";

const Discussion = () => {
  const VOTE_DURATION_SECONDS = 120;

  const { roomCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { playerName, isHost, profileId: stateProfileId } = location.state || {};

  const profileId =
    stateProfileId ||
    (roomCode ? localStorage.getItem(`profile_id_${roomCode?.toUpperCase()}`) : null);

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

  const voteSessionRef = useRef(1);
  const lastVoteSessionRef = useRef(null);
  const endingInProgressRef = useRef(false);
  const serverOffsetRef = useRef(0);
  const hasHandledTimeUp = useRef(false);

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

  const ensureVoteSessionStartedAt = async (roomData, session, isHostFromRoomData) => {
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
          .select("id, room_code, host_id, status, current_round, created_at, settings")
          .eq("room_code", roomCode?.toUpperCase())
          .single();

        if (!roomData) {
          navigate("/");
          return;
        }
        setRoom(roomData);

        const isHostFromRoomData = !!(roomData.host_id && profileId && roomData.host_id === profileId);

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

        const currentParticipant = participants?.find(p => p.user_id === profileId);
        if (currentParticipant?.is_alive === false) {
          setIsSpectator(true);
        }

        const eliminated = participants?.filter(p => p.is_alive === false) || [];
        setEliminatedPlayers(eliminated.map(p => p.user_id));

        const { data: hintsData } = await supabase
          .from("game_hints")
          .select("*")
          .eq("room_id", roomData.id);

        if (hintsData && hintsData.length > 0) {
          const userIds = [...new Set(hintsData.map(h => h.user_id).filter(Boolean))];
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, username")
            .in("id", userIds);
          
          const profileMap = {};
          profilesData?.forEach(p => { profileMap[p.id] = p.username; });
          
          const hintsWithNames = hintsData.map(h => ({
            ...h,
            username: profileMap[h.user_id] || "Unknown"
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

        if (lastVoteSessionRef.current !== null && lastVoteSessionRef.current !== nextVoteSession) {
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

    const myExistingVote = (votesData || []).find(v => v.voter_id === profileId);
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
      const userIds = [...new Set(messagesData.map(m => m.user_id).filter(Boolean))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds);
      
      const profileMap = {};
      profilesData?.forEach(p => { profileMap[p.id] = p.username; });
      
      const messagesWithNames = messagesData.map(m => ({
        ...m,
        username: profileMap[m.user_id] || "Unknown"
      }));
      setMessages(messagesWithNames);
    } else {
      setMessages([]);
    }
  };

  // ✅ VOTE TALLY & ELIMINATION LOGIC
  useEffect(() => {
    if (!room || !players.length) return;

    const activePlayers = players.filter(p => p.is_alive !== false);
    const totalActivePlayers = activePlayers.length;
    const totalVotes = votes.length;

    // Check if voting is complete (everyone has voted) OR time is up
    if (((totalVotes >= totalActivePlayers && totalActivePlayers > 0) || (timeLeft <= 0 && isHostNow)) && !votingComplete) {
      
      // If time is up and not everyone voted, we can either force complete or just tally what we have.
      // Here we assume "tally whatever we have".
      // If NO votes were cast, maybe random? Or skip?
      // Let's adopt a "skip if 0 votes, else tally" approach, or force a random elimination if standard rules.
      // For now, let's just proceed with standard tally logic. If votes=0, it handles it.
      
      const voteCounts = {};
      votes.forEach(v => {
        voteCounts[v.voted_user_id] = (voteCounts[v.voted_user_id] || 0) + 1;
      });

      // Find max votes
      let maxVotes = 0;
      Object.values(voteCounts).forEach(count => {
        if (count > maxVotes) maxVotes = count;
      });
      
      let eliminatedUserId = null;

      if (maxVotes === 0) {
        // No one voted. In many games this means no one dies, or random.
        // Let's assume for safety we skip elimination if nobody voted.
        // OR we can force a random kill. Given "Word Traitor" style, likely random or skip.
        // Let's implemented SKIP for safety to avoid crashing if no candidates.
        console.log("⏰ Time up with 0 votes. Skipping elimination.");
        // If we skip, we just set VotingComplete -> Show Results (where we say "No one died")
        // But UI expects `votedPlayer`. Let's create a "None" state or just pick random if that's the rule.
        // Let's pick a random active player to keep game moving if forced.
        if (activePlayers.length > 0 && isHostNow) {
             const randomIdx = Math.floor(Math.random() * activePlayers.length);
             eliminatedUserId = activePlayers[randomIdx].user_id;
             console.log("🎲 Time up! Randomly eliminating:", eliminatedUserId);
        }
      } else {
          // Find all candidates with maxVotes (handling ties)
          const topCandidates = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);

          if (topCandidates.length === 1) {
            // Clear winner
            eliminatedUserId = topCandidates[0];
          } else {
            // TIE: Randomly pick one from the top candidates
            const randomIndex = Math.floor(Math.random() * topCandidates.length);
            eliminatedUserId = topCandidates[randomIndex];
            console.log("🎲 Tie detected! Randomly eliminating:", eliminatedUserId);
          }
      }

      if (eliminatedUserId) {
        const votedPlayerData = players.find(p => p.user_id === eliminatedUserId);
        setVotedPlayer(votedPlayerData);
        setVotingComplete(true);
        setShowResults(true);

        // If traitor is voted out, end game immediately (host persists for everyone)
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

    const alivePlayers = players.filter(p => p.is_alive !== false);
    const traitorAlive = alivePlayers.some(p => p.user_id === traitorId);

    // If only 2 players remain alive and traitor is among them, traitor wins.
    if (alivePlayers.length <= 2 && traitorAlive) {
      endGame({
        winner: "traitor",
        reason: "two_players_left",
        traitorId,
      });
    }
  }, [players, traitorId, room, isHostNow]);

  useEffect(() => {
    if (!room) return;

    const messagesChannel = supabase
      .channel(`chat_${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        () => fetchMessages(room.id)
      )
      .subscribe();

    const votesChannel = supabase
      .channel(`votes_${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_votes",
        },
        () => fetchVotes(room.id, voteSessionRef.current)
      )
      .subscribe();

    const roomChannel = supabase
      .channel(`room_status_${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_rooms",
        },
        (payload) => {
          if (payload.new?.room_code !== roomCode?.toUpperCase()) return;

          // Update local room state immediately to handle host changes
          setRoom((prev) => ({ ...(prev || {}), ...payload.new }));

          if (payload.new?.status === "waiting") {
            navigate(`/lobby/${roomCode}`, {
              state: { playerName, isHost: payload.new?.host_id === profileId, profileId },
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
        {
          event: "*", // Changed from "UPDATE" to "*" to catch DELETEs (ghost cleanup)
          schema: "public",
          table: "room_participants",
        },
        async () => {
          const { data: participants } = await supabase
            .from("room_participants")
            .select("*, profiles!room_participants_user_id_fkey(username)")
            .eq("room_id", room.id);

          setPlayers(participants || []);

          const currentParticipant = participants?.find(p => p.user_id === profileId);
          if (currentParticipant?.is_alive === false) {
            setIsSpectator(true);
          }

          const eliminated = participants?.filter(p => p.is_alive === false) || [];
          setEliminatedPlayers(eliminated.map(p => p.user_id));
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
      
      // Safety trigger: if logic failed to catch 0 via other effect
      if (remaining <= 0 && isHostNow && !votingComplete && !hasHandledTimeUp.current) {
        hasHandledTimeUp.current = true;
        // The effect below will catch 'timeLeft <= 0' and trigger completion logic
      }
    };

    tick(); // immediate update
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
    if (!profileId || !room || myVote || votingComplete || isSpectator) {
      return;
    }

    const { error } = await supabase.from("game_votes").insert({
      room_id: room.id,
      voter_id: profileId,
      voted_user_id: votedForId,
      round_number: voteSessionRef.current,
    });

    if (!error) {
      setMyVote(votedForId);
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
    const player = players.find(p => p.user_id === odId);
    return player?.profiles?.username || "Unknown";
  };

  const getVoteCount = (playerId) => {
    return votes.filter(v => v.voted_user_id === playerId).length;
  };

  const isTraitor = votedPlayer?.user_id === traitorId;

  const handleBackToLobby = async () => {
    if (!room) return;
    try {
      await supabase.from("game_votes").delete().eq("room_id", room.id);
      await supabase.from("game_hints").delete().eq("room_id", room.id);
      await supabase.from("chat_messages").delete().eq("room_id", room.id);
      await supabase.from("round_secrets").delete().eq("room_id", room.id);
      await supabase
        .from("room_participants")
        .update({ is_alive: true })
        .eq("room_id", room.id);
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
          },
        })
        .eq("id", room.id);

      navigate(`/lobby/${roomCode}`, {
        state: { playerName, isHost: room.host_id === profileId, profileId }
      });
    } catch (error) {
      console.error("Error returning to lobby:", error);
    }
  };

  const handleContinueGame = async () => {
    if (!room || !votedPlayer) return;
    if (!isHostNow) return;

    try {
      // Mark the voted player as eliminated
      await supabase
        .from("room_participants")
        .update({ is_alive: false })
        .eq("room_id", room.id)
        .eq("user_id", votedPlayer.user_id);

      // Check win condition immediately after elimination
      const { data: updatedParticipants } = await supabase
        .from("room_participants")
        .select("user_id, is_alive, role")
        .eq("room_id", room.id);

      const alivePlayers = (updatedParticipants || []).filter(p => p.is_alive !== false);
      const traitorAlive = alivePlayers.some(p => p.user_id === traitorId || p.role === "traitor");
      
      if (alivePlayers.length <= 2 && traitorAlive) {
        await endGame({
          winner: "traitor",
          reason: "two_players_left",
          traitorId,
        });
        return;
      }

      await supabase.from("game_hints").delete().eq("room_id", room.id);
      await supabase.from("game_votes").delete().eq("room_id", room.id).eq("round_number", voteSessionRef.current);

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

      navigate(`/hint/${roomCode}`, {
        state: { playerName, isHost: true, profileId },
      });
    } catch (error) {
      console.error("Error continuing game:", error);
    }
  };

  if (gameResult?.winner) {
    const traitorName = traitorId ? getPlayerName(traitorId) : "Unknown";
    const citizensWon = gameResult.winner === "citizens";

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
          <div className="bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-8 shadow-xl animate-fade-in-up text-center">
            <div className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center ${
              citizensWon ? "bg-green-500/20 border-2 border-green-500" : "bg-red-500/20 border-2 border-red-500"
            }`}>
              {citizensWon ? (
                <Trophy className="w-10 h-10 text-green-500" />
              ) : (
                <Skull className="w-10 h-10 text-red-500" />
              )}
            </div>

            <h1 className="text-3xl font-heading font-bold mb-2">
              {citizensWon ? "Citizens Win!" : "Traitor Wins!"}
            </h1>

            <p className="text-muted-foreground mb-6">
              {citizensWon
                ? "The traitor has been eliminated."
                : "Only two players remain. The traitor escapes."}
            </p>

            <div className="bg-background/50 rounded-xl p-4 mb-6">
              <h3 className="text-lg font-bold mb-2">Traitor Reveal</h3>
              <p className="text-sm text-muted-foreground">The traitor was</p>
              <p className="text-xl font-heading font-bold text-secondary">{traitorName}</p>
            </div>

            <Button
              variant="neonCyan"
              size="lg"
              onClick={handleBackToLobby}
              disabled={!isHostNow}
            >
              {isHostNow ? "Back to Lobby" : "Waiting for host..."}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (showResults && votedPlayer) {
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
          <div className="bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-8 shadow-xl animate-fade-in-up text-center">
            <div className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center ${
              isTraitor ? "bg-green-500/20 border-2 border-green-500" : "bg-red-500/20 border-2 border-red-500"
            }`}>
              {isTraitor ? (
                <Trophy className="w-10 h-10 text-green-500" />
              ) : (
                <Skull className="w-10 h-10 text-red-500" />
              )}
            </div>

            <h1 className="text-3xl font-heading font-bold mb-2">
              {votedPlayer.profiles?.username} was voted out!
            </h1>

            <div className={`text-xl font-bold mb-6 ${isTraitor ? "text-green-500" : "text-red-500"}`}>
              {isTraitor ? (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-6 h-6" />
                  They were the TRAITOR!
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <XCircle className="w-6 h-6" />
                  They were INNOCENT!
                </span>
              )}
            </div>

            <div className="bg-background/50 rounded-xl p-4 mb-6">
              <h3 className="text-lg font-bold mb-3">Vote Results</h3>
              <div className="space-y-2">
                {players.map(p => (
                  <div key={p.user_id} className="flex items-center justify-between">
                    <span className={""}>
                      {p.profiles?.username}
                      {p.is_alive === false && " (Eliminated)"}
                    </span>
                    <span className="font-mono">{getVoteCount(p.user_id)} votes</span>
                  </div>
                ))}
              </div>
            </div>

            {isTraitor ? (
              <>
                <div className="text-2xl font-heading font-bold text-green-500 mb-6">
                  🎉 Citizens Win! 🎉
                </div>
                <Button
                  variant="neonCyan"
                  size="lg"
                  onClick={handleBackToLobby}
                >
                  Back to Lobby
                </Button>
              </>
            ) : (
              <>
                <div className="text-xl font-heading font-bold text-yellow-500 mb-4">
                  😢 An innocent was eliminated!
                </div>
                <p className="text-muted-foreground mb-6">
                  The traitor is still among you. Drop new hints and continue the hunt!
                </p>
                <Button
                  variant="neonCyan"
                  size="lg"
                  onClick={handleContinueGame}
                  disabled={!isHostNow}
                >
                  {isHostNow ? "Continue to Hint Phase" : "Waiting for host..."}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background gradient-mesh relative">
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
                    <div className="text-sm text-muted-foreground mb-1">
                      {h.username}
                    </div>
                    <div className="text-lg font-medium text-primary">
                      "{h.hint}"
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4 animate-fade-in-up">
            <div className="bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-4 h-[350px] flex flex-col">
              <h2 className="text-lg font-heading font-bold mb-4">
                Discuss & Debate
              </h2>

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
                  {votes.length}/{players.filter(p => p.is_alive !== false).length} voted
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
                    .filter(p => p.user_id !== profileId && p.is_alive !== false)
                    .map(p => (
                      <Button
                        key={p.user_id}
                        variant="outline"
                        className="h-auto py-3 flex flex-col items-center gap-1 hover:bg-red-500/20 hover:border-red-500/50"
                        onClick={() => handleVote(p.user_id)}
                        disabled={!!myVote || isSpectator}
                      >
                        <span className="font-bold">{p.profiles?.username}</span>
                        <span className="text-xs text-muted-foreground">
                          {getVoteCount(p.user_id)} votes
                        </span>
                      </Button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Discussion;
