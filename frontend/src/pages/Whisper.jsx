import { useEffect, useState, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowLeft } from "lucide-react"; // Import Icons
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabaseClient";
import { useRoomPresence } from "@/lib/useRoomPresence";

const Whisper = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { playerName, isHost, profileId: stateProfileId } = location.state || {};
  
  const profileId =
    stateProfileId ||
    (roomCode ? localStorage.getItem(`profile_id_${roomCode?.toUpperCase()}`) : null);

  const [secretWord, setSecretWord] = useState(null);
  const [role, setRole] = useState(null); // 'civilian' or 'traitor'
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRevealed, setIsRevealed] = useState(false);
  
  // Audio for reveal effect
  const revealAudioRef = useRef(new Audio("/sounds/reveal.mp3"));

  // Check if current user is host (fallback)
  const isHostNow = room?.host_id === profileId;

  // 📡 PRESENCE HOOK
  useRoomPresence(roomCode, room?.id, profileId, isHostNow);

  useEffect(() => {
    const fetchGameData = async () => {
      try {
        setLoading(true);

        // 1. Get room details
        const { data: roomData, error: roomError } = await supabase
          .from("game_rooms")
          .select("id, room_code, host_id, status, current_round")
          .eq("room_code", roomCode?.toUpperCase())
          .single();

        if (roomError || !roomData) {
          console.error("Room fetch error:", roomError);
          navigate("/");
          return;
        }
        setRoom(roomData);
        
        // If status moved past playing (e.g. to hint_drop), redirect immediately
        if (roomData.status === "hint_drop") {
           navigate(`/hint/${roomCode}`, { state: { playerName, isHost, profileId } });
           return;
        }

        const roundNumber = roomData.current_round || 1;

        // 2. Get MY role & secret word for this round
        const { data: secretData, error: secretError } = await supabase
          .from("round_secrets")
          .select("role, secret_word")
          .eq("room_id", roomData.id)
          .eq("user_id", profileId)
          .eq("round_number", roundNumber)
          .single();

        if (secretError) {
          console.error("Secret fetch error:", secretError);
        } else {
          setRole(secretData.role);
          setSecretWord(secretData.secret_word);
        }
      } catch (error) {
        console.error("Error fetching whisper data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchGameData();

    // Subscribe to room updates (to know when to move to hint phase)
    const channel = supabase
      .channel(`whisper_${roomCode}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_rooms" },
        (payload) => {
          if (payload.new?.room_code === roomCode?.toUpperCase()) {
             setRoom(payload.new);
             if (payload.new.status === "hint_drop") {
                navigate(`/hint/${roomCode}`, { state: { playerName, isHost, profileId } });
             }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, profileId, navigate, playerName, isHost]);

  const handleContinue = async () => {
    if (!room || !isHostNow) return;

    // Move game to 'hint_drop' phase
    const { error } = await supabase
      .from("game_rooms")
      .update({ 
         status: "hint_drop",
         settings: {
            ...room.settings,
            hintStartedAt: new Date().toISOString() // Start timer now
         }
      })
      .eq("id", room.id);

    if (error) {
      console.error("Error updating room status:", error);
    }
  };
  
  const toggleReveal = () => {
     if (!isRevealed) {
        revealAudioRef.current.play().catch(() => {});
     }
     setIsRevealed(!isRevealed);
  };

  return (
    <div className="min-h-screen bg-background gradient-mesh flex flex-col items-center justify-center p-4">
      {/* Top Bar */}
      <div className="absolute top-4 left-4">
         <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
         </Button>
      </div>
      
      <div className="max-w-md w-full space-y-8 animate-fade-in-up">
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-heading font-extrabold tracking-tight">
            Your Secret Role
          </h1>
          <p className="text-muted-foreground">
            Tap the card to reveal your identity.
          </p>
        </div>

        <div className="perspective-1000">
          <Card 
            onClick={toggleReveal}
            className={`
               relative w-full aspect-[3/4] sm:aspect-square max-h-[400px] mx-auto cursor-pointer 
               transition-all duration-700 transform-style-3d 
               ${isRevealed ? "rotate-y-180" : ""}
            `}
          >
            {/* FRONT (Hidden) */}
            <div className="absolute inset-0 backface-hidden flex flex-col items-center justify-center bg-card/80 border-2 border-primary/20 rounded-xl shadow-2xl p-6">
               <Eye className="w-16 h-16 text-primary mb-4 animate-pulse" />
               <h3 className="text-2xl font-bold text-primary">TAP TO REVEAL</h3>
               <p className="text-sm text-muted-foreground mt-2">Shhh! Don't let others see.</p>
            </div>

            {/* BACK (Revealed) */}
            <div className="absolute inset-0 backface-hidden rotate-y-180 flex flex-col items-center justify-center bg-background border-2 border-primary rounded-xl shadow-2xl p-6">
               {loading ? (
                  <div className="space-y-4 w-full flex flex-col items-center">
                     <Skeleton className="h-4 w-24" />
                     <Skeleton className="h-12 w-48" />
                     <Skeleton className="h-4 w-32" />
                  </div>
               ) : (
                  <>
                     <div className="mb-6">
                        {role === "traitor" ? (
                           <span className="text-4xl">🔪</span>
                        ) : (
                           <span className="text-4xl">🕵️</span>
                        )}
                     </div>
                     
                     <h2 className="text-xl font-medium text-muted-foreground mb-1 uppercase tracking-widest">
                        You are a
                     </h2>
                     <h1 className={`text-4xl sm:text-5xl font-heading font-black mb-8 ${role === 'traitor' ? 'text-red-500' : 'text-blue-500'}`}>
                        {role?.toUpperCase()}
                     </h1>

                     <div className="bg-muted/30 p-4 rounded-xl w-full text-center border border-border/50">
                        <p className="text-sm text-muted-foreground mb-1">Your Secret Word</p>
                        <p className="text-2xl font-bold text-primary">{secretWord}</p>
                     </div>
                     
                     <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground/60">
                        <EyeOff className="w-3 h-3" />
                        Tap again to hide
                     </div>
                  </>
               )}
            </div>
          </Card>
        </div>

        {/* Host Controls */}
        <div className="text-center pt-4">
           {isHostNow ? (
              <Button 
                variant="neonCyan" 
                size="lg" 
                className="w-full sm:w-auto px-8 py-6 text-lg"
                onClick={handleContinue}
              >
                 Start Round 1
              </Button>
           ) : (
              <p className="text-sm text-muted-foreground animate-pulse">
                 Waiting for host to start the round...
              </p>
           )}
        </div>
      </div>
    </div>
  );
};

export default Whisper;
