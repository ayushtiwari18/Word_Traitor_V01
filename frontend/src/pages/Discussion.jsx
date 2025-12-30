import { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { MessageCircle, Send, Clock, Users, Vote, CheckCircle, XCircle, Trophy, Skull } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";

const Discussion = () => {
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
  const [timeLeft, setTimeLeft] = useState(120);
  
  const [myVote, setMyVote] = useState(null);
  const [votes, setVotes] = useState([]);
  const [votingComplete, setVotingComplete] = useState(false);
  const [votedPlayer, setVotedPlayer] = useState(null);
  const [traitorId, setTraitorId] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [eliminatedPlayers, setEliminatedPlayers] = useState([]);

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

        const { data: participants } = await supabase
          .from("room_participants")
          .select("*, profiles!room_participants_user_id_fkey(username)")
          .eq("room_id", roomData.id);

        setPlayers(participants || []);

        // Check if current player is a spectator (eliminated)
        const currentParticipant = participants?.find(p => p.user_id === profileId);
        if (currentParticipant?.is_alive === false) {
          setIsSpectator(true);
        }

        // Get list of eliminated players
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
          console.log("🔍 Traitor identified:", traitor.user_id);
        }

        await fetchVotes(roomData.id);
        fetchMessages(roomData.id);
      } catch (error) {
        console.error("Error:", error);
      }
    };

    fetchData();
  }, [roomCode, navigate, profileId]);

  const fetchVotes = async (roomId) => {
    const { data: votesData } = await supabase
      .from("game_votes")
      .select("*")
      .eq("room_id", roomId);

    setVotes(votesData || []);

    const myExistingVote = votesData?.find(v => v.voter_id === profileId);
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

  useEffect(() => {
    if (!room || !players.length) return;

    // Only count active players (not spectators) for voting
    const activePlayers = players.filter(p => p.is_alive !== false);
    const totalActivePlayers = activePlayers.length;
    const totalVotes = votes.length;

    if (totalVotes >= totalActivePlayers && totalActivePlayers > 0 && !votingComplete) {
      const voteCounts = {};
      votes.forEach(v => {
        voteCounts[v.voted_user_id] = (voteCounts[v.voted_user_id] || 0) + 1;
      });

      let maxVotes = 0;
      let mostVoted = null;
      Object.entries(voteCounts).forEach(([odId, count]) => {
        if (count > maxVotes) {
          maxVotes = count;
          mostVoted = odId;
        }
      });

      const votedPlayerData = players.find(p => p.user_id === mostVoted);
      setVotedPlayer(votedPlayerData);
      setVotingComplete(true);
      setShowResults(true);
    }
  }, [votes, players, room, votingComplete]);

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
        () => fetchVotes(room.id)
      )
      .subscribe();

    // Subscribe to room status changes (for back to lobby)
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
          if (payload.new?.room_code === roomCode?.toUpperCase() && payload.new?.status === "waiting") {
            navigate(`/lobby/${roomCode}`, {
              state: { playerName, isHost: payload.new?.host_id === profileId, profileId }
            });
          }
        }
      )
      .subscribe();

    // Subscribe to participant changes (for spectator updates)
    const participantsChannel = supabase
      .channel(`participants_${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "room_participants",
        },
        async () => {
          // Refresh participants to get updated spectator status
          const { data: participants } = await supabase
            .from("room_participants")
            .select("*, profiles!room_participants_user_id_fkey(username)")
            .eq("room_id", room.id);

          setPlayers(participants || []);

          // Check if current player became a spectator (is_alive === false)
          const currentParticipant = participants?.find(p => p.user_id === profileId);
          if (currentParticipant?.is_alive === false) {
            setIsSpectator(true);
          }

          // Update eliminated players list
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

  useEffect(() => {
    if (timeLeft <= 0 || votingComplete) return;

    const timer = setTimeout(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, votingComplete]);

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
      console.log("Vote blocked:", { profileId, room: !!room, myVote, votingComplete, isSpectator });
      return;
    }

    console.log("Submitting vote:", { room_id: room.id, voter_id: profileId, voted_user_id: votedForId });

    const { data, error } = await supabase.from("game_votes").insert({
      room_id: room.id,
      voter_id: profileId,
      voted_user_id: votedForId,
      round_number: room.current_round || 1,
    }).select();

    if (error) {
      console.error("Vote error:", error);
    } else {
      console.log("Vote success:", data);
      setMyVote(votedForId);
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

  // Handle going back to lobby (when traitor is caught)
  const handleBackToLobby = async () => {
    if (!room) return;

    try {
      // Reset game state - clear votes, hints, and reset room status
      await supabase.from("game_votes").delete().eq("room_id", room.id);
      await supabase.from("game_hints").delete().eq("room_id", room.id);
      await supabase.from("chat_messages").delete().eq("room_id", room.id);
      await supabase.from("round_secrets").delete().eq("room_id", room.id);

      // Reset all participants to alive
      await supabase
        .from("room_participants")
        .update({ is_alive: true })
        .eq("room_id", room.id);

      // Update room status to waiting
      await supabase
        .from("game_rooms")
        .update({ status: "waiting", current_round: 1 })
        .eq("id", room.id);

      navigate(`/lobby/${roomCode}`, {
        state: { playerName, isHost: room.host_id === profileId, profileId }
      });
    } catch (error) {
      console.error("Error returning to lobby:", error);
    }
  };

  // Handle continuing the game when an innocent is kicked
  const handleContinueGame = async () => {
    if (!room || !votedPlayer) return;

    try {
      // Mark the voted player as eliminated (spectator)
      await supabase
        .from("room_participants")
        .update({ is_alive: false })
        .eq("room_id", room.id)
        .eq("user_id", votedPlayer.user_id);

      // Clear votes for the next round of voting
      await supabase.from("game_votes").delete().eq("room_id", room.id);

      // Reset local state for next voting round
      setVotes([]);
      setMyVote(null);
      setVotingComplete(false);
      setShowResults(false);
      setVotedPlayer(null);
      setTimeLeft(120);

      // Update eliminated players list
      setEliminatedPlayers(prev => [...prev, votedPlayer.user_id]);

      // Check if current user was the one kicked
      if (votedPlayer.user_id === profileId) {
        setIsSpectator(true);
      }
    } catch (error) {
      console.error("Error continuing game:", error);
    }
  };

  if (showResults && votedPlayer) {
    return (
      <div className="min-h-screen bg-background gradient-mesh flex items-center justify-center">
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
                    <span className={p.user_id === traitorId ? "text-red-400" : ""}>
                      {p.profiles?.username}
                      {p.user_id === traitorId && " (Traitor)"}
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
                  The traitor is still among you. Continue the hunt!
                </p>
                <Button
                  variant="neonCyan"
                  size="lg"
                  onClick={handleContinueGame}
                >
                  Continue Voting
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background gradient-mesh">
      <div className="container max-w-4xl mx-auto px-4 py-6">
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
