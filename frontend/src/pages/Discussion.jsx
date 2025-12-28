import { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { MessageCircle, Send, Clock, Users, ArrowRight } from "lucide-react";
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
  const [discussionTime, setDiscussionTime] = useState(120); // 2 minutes default
  const [timeLeft, setTimeLeft] = useState(120);

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!profileId) {
          console.error("No profileId found");
          navigate("/");
          return;
        }

        // Get room
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

        // Get participants
        const { data: participants } = await supabase
          .from("room_participants")
          .select("*, profiles!room_participants_user_id_fkey(username)")
          .eq("room_id", roomData.id);

        setPlayers(participants || []);

        // Get all hints
        const { data: hintsData } = await supabase
          .from("game_hints")
          .select("*, profiles!game_hints_user_id_fkey(username)")
          .eq("room_id", roomData.id);

        setHints(hintsData || []);

        // Get chat messages
        fetchMessages(roomData.id);
      } catch (error) {
        console.error("Error:", error);
      }
    };

    fetchData();
  }, [roomCode, navigate, profileId]);

  const fetchMessages = async (roomId) => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*, profiles!chat_messages_user_id_fkey(username)")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    setMessages(data || []);
  };

  // Realtime subscriptions
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

    const roomChannel = supabase
      .channel(`room_voting_${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_rooms",
        },
        (payload) => {
          if (payload.new?.room_code === roomCode?.toUpperCase() && payload.new?.status === "voting") {
            navigate(`/vote/${roomCode}`, { state: { playerName, isHost, profileId } });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(roomChannel);
    };
  }, [room, roomCode, navigate, playerName, isHost, profileId]);

  // Timer
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setTimeout(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !profileId || !room) return;

    await supabase.from("chat_messages").insert({
      room_id: room.id,
      user_id: profileId,
      message: newMessage.trim(),
    });

    setNewMessage("");
  };

  const handleMoveToVoting = async () => {
    if (!isHost || !room) return;

    const { error } = await supabase
      .from("game_rooms")
      .update({ status: "voting" })
      .eq("id", room.id);

    if (!error) {
      navigate(`/vote/${roomCode}`, { state: { playerName, isHost, profileId } });
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getPlayerName = (userId) => {
    const player = players.find(p => p.user_id === userId);
    return player?.profiles?.username || "Unknown";
  };

  return (
    <div className="min-h-screen bg-background gradient-mesh">
      <div className="container max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 animate-fade-in-up">
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-primary" />
            Discussion Phase
          </h1>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/50 border border-border/40">
            <Clock className={`w-5 h-5 ${timeLeft <= 30 ? "text-red-500" : "text-primary"}`} />
            <span className={`font-mono text-lg ${timeLeft <= 30 ? "text-red-500" : ""}`}>
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Hints Panel */}
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
                      {h.profiles?.username}
                    </div>
                    <div className="text-lg font-medium text-primary">
                      "{h.hint}"
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {isHost && (
              <Button
                variant="neonCyan"
                size="lg"
                className="w-full gap-2"
                onClick={handleMoveToVoting}
              >
                Proceed to Voting
                <ArrowRight className="w-5 h-5" />
              </Button>
            )}
          </div>

          {/* Chat Panel */}
          <div className="lg:col-span-2 animate-fade-in-up">
            <div className="bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-4 h-[500px] flex flex-col">
              <h2 className="text-lg font-heading font-bold mb-4">
                Discuss & Debate
              </h2>

              {/* Messages */}
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
                        msg.user_id === currentUser?.id
                          ? "bg-primary/20 border border-primary/30 ml-8"
                          : "bg-muted/50 border border-border/40 mr-8"
                      }`}
                    >
                      <div className="text-xs text-muted-foreground mb-1">
                        {msg.profiles?.username || getPlayerName(msg.user_id)}
                      </div>
                      <div className="text-sm">{msg.message}</div>
                    </div>
                  ))
                )}
              </div>

              {/* Input */}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default Discussion;
