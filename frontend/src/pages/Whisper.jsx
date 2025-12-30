import { useEffect, useState, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import TraitorLeftModal from "@/components/TraitorLeftModal";

const Whisper = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    playerName,
    isHost,
    profileId: stateProfileId,
  } = location.state || {};

  const profileId =
    stateProfileId ||
    (roomCode
      ? localStorage.getItem(`profile_id_${roomCode?.toUpperCase()}`)
      : null);

  const [revealed, setRevealed] = useState(false);
  const [secretWord, setSecretWord] = useState(null);
  const [wordDescription, setWordDescription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState(null);
  const [countdown, setCountdown] = useState(10);
  const countdownRef = useRef(null);
  const hasNavigated = useRef(false);
  const [showTraitorLeftModal, setShowTraitorLeftModal] = useState(false);

  const isHostNow = !!(room?.host_id && profileId && room.host_id === profileId);

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
          .select(
            "id, room_code, host_id, status, current_round, created_at, settings"
          )
          .eq("room_code", roomCode?.toUpperCase())
          .single();

        if (roomErr || !roomData) {
          console.error("Room not found", roomErr);
          navigate("/");
          return;
        }
        setRoom(roomData);

        const isHostFromRoom = !!(roomData.host_id && profileId && roomData.host_id === profileId);

        if (roomData.status === "hint_drop" && !hasNavigated.current) {
          hasNavigated.current = true;
          navigate(`/hint/${roomCode}`, {
            state: { playerName, isHost: isHostFromRoom, profileId },
          });
          return;
        }

        const { data: secretData, error: secretErr } = await supabase
          .from("round_secrets")
          .select("secret_word")
          .eq("room_id", roomData.id)
          .eq("user_id", profileId)
          .eq("round_number", roomData.current_round || 1)
          .single();

        if (secretErr) {
          console.log("No secret assigned yet, waiting...", secretErr);
        } else {
          setSecretWord(secretData);
          // Word descriptions depend on word_pairs relation; keep optional.
          setWordDescription(null);
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
          if (
            payload.new?.room_code === roomCode?.toUpperCase() &&
            payload.new?.status === "hint_drop" &&
            !hasNavigated.current
          ) {
            hasNavigated.current = true;
            const isHostFromPayload = !!(
              payload.new?.host_id &&
              profileId &&
              payload.new.host_id === profileId
            );
            navigate(`/hint/${roomCode}`, {
              state: { playerName, isHost: isHostFromPayload, profileId },
            });
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
      countdownRef.current = setTimeout(
        () => setCountdown(countdown - 1),
        1000
      );
      return () => clearTimeout(countdownRef.current);
    }

    if (
      revealed &&
      countdown === 0 &&
      isHostNow &&
      room &&
      !hasNavigated.current
    ) {
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
          navigate(`/hint/${roomCode}`, {
            state: { playerName, isHost: true, profileId },
          });
        }
      };
      moveToHintPhase();
    }
  }, [
    revealed,
    countdown,
    isHostNow,
    room,
    roomCode,
    navigate,
    playerName,
    profileId,
  ]);

  const handleLeaveGame = async () => {
    if (!profileId || !room) {
      navigate("/");
      return;
    }

    try {
      // Check if this player is the traitor (role assigned by start-round)
      const { data: participantData } = await supabase
        .from("room_participants")
        .select("role")
        .eq("room_id", room.id)
        .eq("user_id", profileId)
        .single();

      const isTraitor = participantData?.role === "traitor";

      // Delete participant from room
      await supabase
        .from("room_participants")
        .delete()
        .eq("room_id", room.id)
        .eq("user_id", profileId);

      // If traitor left, notify other players by updating room status
      if (isTraitor) {
        await supabase
          .from("game_rooms")
          .update({
            status: "traitor_left",
            updated_at: new Date().toISOString(),
          })
          .eq("id", room.id);
      }

      localStorage.removeItem(`profile_id_${roomCode?.toUpperCase()}`);
      navigate("/");
    } catch (err) {
      console.error("Error leaving game:", err);
      navigate("/");
    }
  };

  // Add realtime subscription to detect traitor leaving
  useEffect(() => {
    if (!room) return;

    const traitorLeftChannel = supabase
      .channel(`traitor_status_${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_rooms",
        },
        (payload) => {
          if (payload.new?.status === "traitor_left") {
            setShowTraitorLeftModal(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(traitorLeftChannel);
    };
  }, [room, roomCode]);

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
    <>
      <div className="min-h-screen bg-background gradient-mesh flex items-center justify-center">
        {/* Exit Button - Top Left */}
        <div className="absolute top-4 left-4 z-10">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={handleLeaveGame}
          >
            <ArrowLeft className="w-4 h-4" />
            Exit
          </Button>
        </div>

        <div className="container max-w-lg mx-auto px-4">
          <div className="bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-8 shadow-xl animate-fade-in-up text-center">
            <h1 className="text-2xl font-heading font-bold mb-2">
              Your Secret Word
            </h1>
            <p className="text-muted-foreground mb-8">
              Memorize your word. Don't reveal it to others!
            </p>

            {/* Word Reveal Card */}
            <div className="relative mb-8">
              <div
                className={`
                p-8 rounded-xl border-2 transition-all duration-500
                ${
                  revealed
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
                    {wordDescription && (
                      <p className="mt-4 text-base text-muted-foreground italic">
                        "{wordDescription}"
                      </p>
                    )}
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
      {/* Traitor Left Modal */}
      {showTraitorLeftModal && (
        <TraitorLeftModal
          roomCode={roomCode}
          playerName={playerName}
          isHost={isHost}
          profileId={profileId}
        />
      )}
    </>
  );
};

export default Whisper;
