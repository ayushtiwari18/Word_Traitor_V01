import { useEffect, useState, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";

const Whisper = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { playerName, isHost, profileId: stateProfileId } = location.state || {};

  const profileId =
    stateProfileId ||
    (roomCode ? localStorage.getItem(`profile_id_${roomCode?.toUpperCase()}`) : null);

  const [revealed, setRevealed] = useState(false);
  const [secretWord, setSecretWord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState(null);
  const [countdown, setCountdown] = useState(10);
  const countdownRef = useRef(null);
  const hasNavigated = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!profileId) {
          console.error("No profileId found");
          navigate("/");
          return;
        }

        const { data: roomData, error: roomErr } = await supabase
          .from("game_rooms")
          .select("id, room_code, host_id, status, current_round, created_at, settings")
          .eq("room_code", roomCode?.toUpperCase())
          .single();

        if (roomErr || !roomData) {
          console.error("Room not found", roomErr);
          navigate("/");
          return;
        }
        setRoom(roomData);

        if (roomData.status === "hint_drop" && !hasNavigated.current) {
          hasNavigated.current = true;
          navigate(`/hint/${roomCode}`, { state: { playerName, isHost, profileId } });
          return;
        }

        const { data: secretData, error: secretErr } = await supabase
          .from("round_secrets")
          .select("*")
          .eq("room_id", roomData.id)
          .eq("user_id", profileId)
          .eq("round_number", roomData.current_round || 1)
          .single();

        if (secretErr) {
          console.log("No secret assigned yet, waiting...", secretErr);
        } else {
          setSecretWord(secretData);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error:", error);
        setLoading(false);
      }
    };

    fetchData();

    const secretsChannel = supabase
      .channel(`secrets_${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "round_secrets",
        },
        () => fetchData()
      )
      .subscribe();

    const roomChannel = supabase
      .channel(`game_phase_${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_rooms",
        },
        (payload) => {
          console.log("🎮 Room status changed:", payload.new?.status);
          if (payload.new?.room_code === roomCode?.toUpperCase() && payload.new?.status === "hint_drop" && !hasNavigated.current) {
            hasNavigated.current = true;
            navigate(`/hint/${roomCode}`, { state: { playerName, isHost, profileId } });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(secretsChannel);
      supabase.removeChannel(roomChannel);
    };
  }, [roomCode, navigate, playerName, isHost, profileId]);

  // Countdown after reveal - auto move to hint phase when countdown reaches 0
  useEffect(() => {
    if (revealed && countdown > 0) {
      countdownRef.current = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(countdownRef.current);
    }

    if (revealed && countdown === 0 && isHost && room && !hasNavigated.current) {
      const moveToHintPhase = async () => {
        console.log("⏰ Countdown ended, moving to hint phase...");
        const { error } = await supabase
          .from("game_rooms")
          .update({ status: "hint_drop" })
          .eq("id", room.id);

        if (error) {
          console.error("Error moving to hint phase:", error);
        } else {
          hasNavigated.current = true;
          navigate(`/hint/${roomCode}`, { state: { playerName, isHost, profileId } });
        }
      };
      moveToHintPhase();
    }
  }, [revealed, countdown, isHost, room, roomCode, navigate, playerName, profileId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background gradient-mesh flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your secret word...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background gradient-mesh flex items-center justify-center">
      <div className="container max-w-lg mx-auto px-4">
        <div className="bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-8 shadow-xl animate-fade-in-up text-center">
          <h1 className="text-2xl font-heading font-bold mb-2">Your Secret Word</h1>
          <p className="text-muted-foreground mb-8">
            Memorize your word. Don't reveal it to others!
          </p>

          {/* Word Reveal Card */}
          <div className="relative mb-8">
            <div
              className={`
                p-8 rounded-xl border-2 transition-all duration-500
                ${revealed 
                  ? "bg-gradient-to-br from-primary/20 to-secondary/20 border-primary/50" 
                  : "bg-muted/50 border-border/50"
                }
              `}
            >
              {revealed ? (
                <div className="animate-fade-in-up">
                  <span className="text-4xl font-heading font-bold text-primary">
                    {secretWord?.secret_word || "No word assigned"}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <EyeOff className="w-6 h-6" />
                  <span className="text-lg">Tap to reveal</span>
                </div>
              )}
            </div>

            {!revealed && (
              <Button
                variant="neonCyan"
                size="lg"
                className="mt-4 gap-2"
                onClick={() => setRevealed(true)}
              >
                <Eye className="w-5 h-5" />
                Reveal Word
              </Button>
            )}
          </div>

          {revealed && (
            <div className="space-y-4 animate-fade-in-up">
              <p className="text-sm text-muted-foreground">
                Remember your word! The hint phase begins soon.
              </p>

              {countdown > 0 ? (
                <div className="text-lg font-mono text-primary">
                  Moving to hint phase in {countdown}s...
                </div>
              ) : (
                <div className="text-lg font-mono text-primary animate-pulse">
                  Starting hint phase...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Whisper;
