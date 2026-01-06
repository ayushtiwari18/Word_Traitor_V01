import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { useMusic } from "@/contexts/MusicContext";

const Whisper = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    playerName: statePlayerName,
    isHost: stateIsHost,
    profileId: stateProfileId,
  } = location.state || {};

  const profileId =
    stateProfileId ||
    (roomCode
      ? localStorage.getItem(`profile_id_${roomCode.toUpperCase()}`)
      : null);

  const [role, setRole] = useState(null);
  const [secretWord, setSecretWord] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [room, setRoom] = useState(null);
  const [roundNumber, setRoundNumber] = useState(1);
  const { setPhase } = useMusic();

  useEffect(() => {
    setPhase("whisper");
  }, [setPhase]);

  // Fetch Secret & Role
  useEffect(() => {
    let mounted = true;

    const fetchGameData = async () => {
      try {
        // 1. Get room details
        const { data: roomData, error: roomErr } = await supabase
          .from("game_rooms")
          .select("*")
          .eq("room_code", roomCode?.toUpperCase())
          .single();

        if (roomErr || !roomData) throw new Error("Room not found");
        if (mounted) {
          setRoom(roomData);
          setRoundNumber(roomData.current_round || 1);
        }

        // 2. Get SECRET for this user & round
        // Note: The edge function should have already created these.
        // We retry a few times if the edge function is slow.
        let secretData = null;
        let attempts = 0;
        
        while (!secretData && attempts < 5) {
             const { data, error } = await supabase
              .from("round_secrets")
              .select("role, secret_word")
              .eq("room_id", roomData.id)
              .eq("user_id", profileId)
              .eq("round_number", roomData.current_round)
              .maybeSingle();
              
             if (data) {
                 secretData = data;
                 break;
             }
             // Wait 500ms before retry
             await new Promise(r => setTimeout(r, 500));
             attempts++;
        }

        if (mounted && secretData) {
          setRole(secretData.role);
          setSecretWord(secretData.secret_word);
        } else if (mounted) {
             console.error("Failed to load secret after retries");
        }
      } catch (err) {
        console.error("Error fetching game data:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    if (profileId && roomCode) {
      fetchGameData();
    }
    
    return () => { mounted = false; };
  }, [roomCode, profileId]);

  // Subscribe to room updates (to move to next phase)
  useEffect(() => {
    const channel = supabase
      .channel(`whisper_${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_rooms",
          filter: `room_code=eq.${roomCode?.toUpperCase()}`,
        },
        (payload) => {
          if (payload.new.status === "hint_drop") {
            navigate(`/hint/${roomCode}`, {
              state: {
                playerName: statePlayerName,
                isHost: stateIsHost, // pass initial state, or derive?
                profileId,
              },
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, navigate, statePlayerName, stateIsHost, profileId]);

  const handleContinue = async () => {
    if (!room) return;
    try {
      const { error } = await supabase
        .from("game_rooms")
        .update({
          status: "hint_drop",
          // Reset hint_baseline timestamp so timer starts NOW
          settings: {
             ...room.settings,
             hint_baseline: Math.floor(Date.now() / 1000), 
          }
        })
        .eq("id", room.id);

      if (error) throw error;
      // Navigation happens via subscription above
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const isHostNow = room && room.host_id === profileId;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background gradient-mesh flex items-center justify-center">
        <div className="animate-pulse text-xl font-heading text-primary">
          Revealing Secrets...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background gradient-mesh flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-card/40 backdrop-blur-md border border-border/40 rounded-3xl p-8 shadow-2xl text-center space-y-8 animate-fade-in-up">
        
        <div className="space-y-2">
           <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
             Round {roundNumber}
           </h2>
           <h1 className="text-3xl sm:text-4xl font-heading font-bold text-foreground">
             Your Secret Role
           </h1>
        </div>

        <div className="py-8 space-y-6">
          <div className="relative group cursor-default">
             <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
             <div className="relative bg-background/80 backdrop-blur-xl border border-primary/20 rounded-xl p-6">
                <span className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  You are a
                </span>
                <span className={`text-4xl font-black tracking-tight ${role === 'traitor' ? 'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.5)]'}`}>
                  {role === "traitor" ? "TRAITOR" : "CIVILIAN"}
                </span>
             </div>
          </div>

          <div className="relative group cursor-default">
             <div className="absolute -inset-1 bg-gradient-to-r from-secondary to-primary rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
             <div className="relative bg-background/80 backdrop-blur-xl border border-secondary/20 rounded-xl p-6">
                <span className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Your Secret Word
                </span>
                <span className="text-3xl font-bold text-foreground">
                  {secretWord || "???"}
                </span>
             </div>
          </div>
        </div>

        <div className="pt-4">
          {isHostNow ? (
            <Button
              variant="neonCyan"
              size="lg"
              className="w-full text-lg h-14 font-bold shadow-lg shadow-cyan-500/20 animate-pulse"
              onClick={handleContinue}
            >
              Start Timer (Begin Hints)
            </Button>
          ) : (
            <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
               <p className="text-primary/80 animate-pulse font-medium">
                 Waiting for host to start the timer...
               </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Whisper;
