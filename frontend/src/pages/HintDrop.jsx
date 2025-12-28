import { useEffect, useState, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Send, Clock, CheckCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";

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
  const [submittedPlayers, setSubmittedPlayers] = useState([]);
  const timerRef = useRef(null);

  // Fetch room and setup
  useEffect(() => {
    const fetchData = async () => {
      try {
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
        setTimeLeft(time);

        // Get participants
        const { data: participants } = await supabase
          .from("room_participants")
          .select("*, profiles!room_participants_user_id_fkey(username)")
          .eq("room_id", roomData.id);

        setPlayers(participants || []);

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
          if (payload.new?.room_code === roomCode?.toUpperCase() && payload.new?.status === "discussion") {
            navigate(`/discussion/${roomCode}`, { state: { playerName, isHost, profileId } });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(hintsChannel);
      supabase.removeChannel(roomChannel);
    };
  }, [room, roomCode, navigate, playerName, isHost, profileId]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) {
      handleTimeUp();
      return;
    }

    timerRef.current = setTimeout(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timerRef.current);
  }, [timeLeft]);

  // Check if all players submitted
  useEffect(() => {
    if (players.length > 0 && submittedPlayers.length >= players.length) {
      // All players submitted, host can proceed
      if (isHost) {
        moveToDiscussion();
      }
    }
  }, [submittedPlayers, players, isHost]);

  const handleTimeUp = async () => {
    // Auto-submit empty hint if not submitted
    if (!submitted && profileId && room) {
      await supabase.from("game_hints").insert({
        room_id: room.id,
        user_id: profileId,
        hint: hint || "(no hint)",
      });
    }
    
    // Host moves everyone to discussion
    if (isHost) {
      setTimeout(() => moveToDiscussion(), 1000);
    }
  };

  const moveToDiscussion = async () => {
    if (!room) return;

    const { error } = await supabase
      .from("game_rooms")
      .update({ status: "discussion" })
      .eq("id", room.id);

    if (!error) {
      navigate(`/discussion/${roomCode}`, { state: { playerName, isHost, profileId } });
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

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-background gradient-mesh flex items-center justify-center">
      <div className="container max-w-lg mx-auto px-4">
        <div className="bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-8 shadow-xl animate-fade-in-up">
          {/* Timer */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <Clock className={`w-6 h-6 ${timeLeft <= 10 ? "text-red-500 animate-pulse" : "text-primary"}`} />
            <span className={`text-3xl font-mono font-bold ${timeLeft <= 10 ? "text-red-500" : "text-primary"}`}>
              {formatTime(timeLeft)}
            </span>
          </div>

          <h1 className="text-2xl font-heading font-bold text-center mb-2">
            Drop Your Hint
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            Give a one-word hint related to your secret word
          </p>

          {/* Hint Input */}
          {!submitted ? (
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
          )}

          {/* Progress */}
          <div className="mt-8 pt-6 border-t border-border/40">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Users className="w-4 h-4" />
              <span>
                {submittedPlayers.length} / {players.length} players submitted
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {players.map((p) => (
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
