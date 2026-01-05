import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Settings,
  HelpCircle,
  Users,
  PlusCircle,
  KeyRound,
  Play,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useMusic } from "@/contexts/MusicContext";

// Generate a random 6-letter room code
const generateRoomCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
};
// Generate random player name
const generateRandomPlayerName = () => {
  const randomNumber = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
  return `Player${randomNumber}`;
};

const ParticleBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-float" />
    <div
      className="absolute top-1/3 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-float"
      style={{ animationDelay: "1s" }}
    />
    <div
      className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-float"
      style={{ animationDelay: "2s" }}
    />
  </div>
);

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [playerName, setPlayerName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [autoJoining, setAutoJoining] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [autoJoinRoomCode, setAutoJoinRoomCode] = useState("");
  const { setPhase } = useMusic();

  // Set Music Phase
  useEffect(() => {
    setPhase("lobby");
  }, [setPhase]);

  // Auto-join functionality when URL has room parameter
  const hasAutoJoined = useRef(false);

  useEffect(() => {
    const roomFromUrl = searchParams.get("room");

    if (roomFromUrl && !hasAutoJoined.current) {
      hasAutoJoined.current = true;
      setAutoJoinRoomCode(roomFromUrl);
      setShowNameModal(true);
    }
  }, [searchParams]);

  // Onboarding Tour
  useEffect(() => {
    const hasOnboarded = localStorage.getItem("has_onboarded_v1");
    if (!hasOnboarded) {
      // Delay to allow animations to complete
      const timer = setTimeout(() => {
        const driverObj = driver({
          showProgress: true,
          animate: true,
          overlayColor: "rgba(0,0,0,0.8)",
          steps: [
            {
              element: "#create-room-btn",
              popover: {
                title: "Start a Game",
                description:
                  "Create a new room and become the host. Share the code with friends!",
                side: "bottom",
                align: "start",
              },
            },
            {
              element: "#join-room-btn",
              popover: {
                title: "Join a Game",
                description:
                  "Enter a room code if your friend already started a lobby.",
                side: "bottom",
                align: "start",
              },
            },
            {
              element: "#feedback-trigger",
              popover: {
                title: "We Listen!",
                description:
                  "Found a bug or have an idea? Click this floating button anytime.",
                side: "left",
                align: "end",
              },
            },
          ],
          onDestroyStarted: () => {
            localStorage.setItem("has_onboarded_v1", "true");
            driverObj.destroy();
          },
        });
        driverObj.drive();
      }, 1500); // 1.5s delay matches CSS animation duration

      return () => clearTimeout(timer);
    }
  }, []);

  const autoJoinRoom = async (code, customName) => {
    // Prevent duplicate calls
    if (autoJoining) return;

    try {
      setAutoJoining(true);
      const upperCode = code.toUpperCase();

      // Check if room exists
      const { data: roomData, error: roomErr } = await supabase
        .from("game_rooms")
        .select("id, room_code, host_id, status")
        .eq("room_code", upperCode)
        .single();

      if (roomErr || !roomData) {
        alert("Room not found or has ended.");
        setAutoJoining(false);
        setShowNameModal(false);
        return;
      }

      if (roomData.status !== "waiting") {
        alert("This game has already started.");
        setAutoJoining(false);
        setShowNameModal(false);
        return;
      }

      // Use custom name or generate random
      const playerNameToUse =
        customName && customName.trim()
          ? customName.trim()
          : generateRandomPlayerName();

      // Create profile
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .insert({ username: playerNameToUse })
        .select()
        .single();

      if (profileErr) {
        console.error("Error creating profile:", profileErr);
        alert("Failed to join room. Please try again.");
        setAutoJoining(false);
        setShowNameModal(false);
        return;
      }

      // Add to room
      const { error: joinErr } = await supabase
        .from("room_participants")
        .insert({
          room_id: roomData.id,
          user_id: profile.id,
        });

      if (joinErr) {
        console.error("Error joining room:", joinErr);
        alert("Failed to join room. Please try again.");
        setAutoJoining(false);
        setShowNameModal(false);
        return;
      }

      // Store profile ID in localStorage
      localStorage.setItem(`profile_id_${upperCode}`, profile.id);

      // Navigate to lobby
      navigate(`/lobby/${upperCode}`, {
        state: {
          playerName: playerNameToUse,
          isHost: false,
          profileId: profile.id,
        },
      });
    } catch (error) {
      console.error("Auto-join error:", error);
      alert("An error occurred while joining the room.");
      setAutoJoining(false);
      setShowNameModal(false);
    }
  };
  const handleNameModalSubmit = () => {
    if (!playerName.trim()) {
      // Use random name if empty
      autoJoinRoom(autoJoinRoomCode, generateRandomPlayerName());
    } else {
      autoJoinRoom(autoJoinRoomCode, playerName);
    }
    setShowNameModal(false);
  };

  const handleSkipName = () => {
    autoJoinRoom(autoJoinRoomCode, generateRandomPlayerName());
    setShowNameModal(false);
  };

  // Helper to get or create profile
  const getOrCreateProfile = async (username) => {
    // Simply insert a new profile each time (allows duplicate usernames)
    const { data, error } = await supabase
      .from("profiles")
      .insert({ username })
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  // Create Room
  const handleCreateRoom = async () => {
    if (!playerName.trim()) return alert("Please enter your name first.");
    try {
      const roomCode = generateRoomCode();

      // 1️⃣ Create / get profile first (used as host_id)
      const profile = await getOrCreateProfile(playerName);

      // 2️⃣ Create room
      const { data: room, error: roomError } = await supabase
        .from("game_rooms")
        .insert({
          room_code: roomCode,
          status: "waiting",
          host_id: profile.id,
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // 3️⃣ Add participant
      const { error: participantError } = await supabase
        .from("room_participants")
        .insert({
          room_id: room.id,
          user_id: profile.id,
          role: "civilian",
          is_alive: true,
        });

      if (participantError) throw participantError;

      // Store profileId for host verification
      localStorage.setItem(`profile_id_${roomCode}`, profile.id);

      // ✅ Redirect to lobby
      navigate(`/lobby/${roomCode}`, {
        state: { playerName, isHost: true, roomCode, profileId: profile.id },
      });
    } catch (err) {
      console.error("Error creating room:", err);
      alert("Failed to create room. Check console for details.");
    }
  };

  // Join Room
  const handleJoinRoom = async () => {
    if (!playerName.trim()) return alert("Enter your name first.");
    if (!joinCode.trim()) return alert("Enter a valid room code.");

    const code = joinCode.trim().toUpperCase();

    try {
      const { data: room, error: roomError } = await supabase
        .from("game_rooms")
        .select("id, status")
        .eq("room_code", code)
        .single();

      if (roomError || !room) {
        alert("Room not found or already started.");
        return;
      }

      // Create / get profile
      const profile = await getOrCreateProfile(playerName);

      // Add participant if not already
      const { error: participantError } = await supabase
        .from("room_participants")
        .insert({
          room_id: room.id,
          user_id: profile.id,
          role: "civilian",
          is_alive: true,
        });

      if (participantError && participantError.code !== "23505")
        throw participantError;

      // Store profileId for later use
      localStorage.setItem(`profile_id_${code}`, profile.id);

      // ✅ Redirect to lobby
      navigate(`/lobby/${code}`, {
        state: {
          playerName,
          isHost: false,
          roomCode: code,
          profileId: profile.id,
        },
      });
    } catch (err) {
      console.error("Error joining room:", err);
      alert("Failed to join room. Check console for details.");
    }
  };
  // Name modal for shareable link
  if (showNameModal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white relative overflow-hidden">
        {/* Background effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
          <div className="w-full max-w-lg">
            {/* Modal Card */}
            <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl p-8 border border-cyan-500/20 shadow-2xl shadow-cyan-500/10">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 mb-4">
                  <Users className="w-8 h-8 text-cyan-400" />
                </div>
                <h2 className="text-3xl font-bold mb-2 text-white">
                  Join the Game
                </h2>
                <p className="text-slate-400 text-sm">
                  Room Code:{" "}
                  <span className="font-mono font-bold text-cyan-400">
                    {autoJoinRoomCode?.toUpperCase()}
                  </span>
                </p>
              </div>

              {/* Name Input */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-cyan-400" />
                    Your Display Name
                  </label>
                  <Input
                    placeholder="Enter your name..."
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") handleNameModalSubmit();
                    }}
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 h-12 text-lg"
                    maxLength={20}
                    autoFocus
                  />
                  <p className="text-xs text-slate-500">
                    This is how other players will see you
                  </p>
                </div>

                {/* Buttons */}
                <div className="space-y-3">
                  <Button
                    onClick={handleNameModalSubmit}
                    className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white font-semibold py-6 text-lg shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all border-0"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    {playerName.trim()
                      ? "Join with this name"
                      : "Join with random name"}
                  </Button>
                </div>

                {/* Info Badge */}
                <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                  <HelpCircle className="w-4 h-4 flex-shrink-0 text-cyan-400" />
                  <span>
                    Skip to get a random name like{" "}
                    <span className="font-mono text-cyan-400">
                      Player{Math.floor(Math.random() * 9000) + 1000}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (autoJoining) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-xl text-slate-300">Joining room...</p>
        </div>
      </div>
    );
  }

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 gradient-mesh pb-16">
      <ParticleBackground />

      {/* Top icons */}
      <div
        className="absolute top-6 right-6 flex items-center gap-3 animate-fade-in-up"
        style={{ animationDelay: "0.8s" }}
      >
        {/* <Link to="/settings">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-primary"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </Link>
        <Link to="/help">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-primary"
          >
            <HelpCircle className="w-5 h-5" />
          </Button>
        </Link> */}
        <Link to="/about">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-primary"
          >
            <Info className="w-5 h-5" />
          </Button>
        </Link>
      </div>

      {/* Title */}
      <div className="flex flex-col items-center text-center z-10 max-w-xl">
        <h1 className="text-6xl sm:text-7xl md:text-8xl font-heading font-extrabold tracking-tight animate-fade-in-up">
          <span className="text-primary text-glow-cyan">Word</span>
          <span className="text-secondary text-glow-purple">Traitor</span>
        </h1>

        <p
          className="text-lg sm:text-xl text-muted-foreground mt-4 mb-10 animate-fade-in-up font-light tracking-wide"
          style={{ animationDelay: "0.2s" }}
        >
          One word apart. One traitor among you.
        </p>

        {/* Player name input */}
        <div
          className="flex flex-col sm:flex-row gap-3 w-full justify-center items-center animate-fade-in-up"
          style={{ animationDelay: "0.4s" }}
        >
          <Input
            placeholder="Enter your name..."
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="max-w-xs bg-card/40 border border-border/50 focus:border-primary placeholder:text-muted-foreground/70"
          />
        </div>

        {/* Room actions */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-12 animate-fade-in-up w-full max-w-2xl"
          style={{ animationDelay: "0.6s" }}
        >
          {/* Create Room */}
          <button
            id="create-room-btn"
            onClick={handleCreateRoom}
            className={cn(
              "group relative p-8 rounded-2xl border-2 bg-card/40 border-primary/30 hover:border-primary hover:bg-primary/10 transition-all duration-300 backdrop-blur-md overflow-hidden"
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 opacity-0 group-hover:opacity-100 blur-2xl transition-all" />
            <div className="relative flex flex-col items-center text-center gap-4">
              <PlusCircle className="w-10 h-10 text-primary group-hover:scale-110 transition-transform" />
              <h3 className="font-heading text-xl font-semibold text-primary">
                Create Room
              </h3>
              <p className="text-sm text-muted-foreground max-w-[200px]">
                Start a new circle and invite friends.
              </p>
            </div>
          </button>

          {/* Join Room */}
          <button
            id="join-room-btn"
            onClick={() => setJoining(true)}
            className={cn(
              "group relative p-8 rounded-2xl border-2 bg-card/40 border-secondary/30 hover:border-secondary hover:bg-secondary/10 transition-all duration-300 backdrop-blur-md overflow-hidden"
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/20 to-primary/20 opacity-0 group-hover:opacity-100 blur-2xl transition-all" />
            <div className="relative flex flex-col items-center text-center gap-4">
              <Users className="w-10 h-10 text-secondary group-hover:scale-110 transition-transform" />
              <h3 className="font-heading text-xl font-semibold text-secondary">
                Join Room
              </h3>
              <p className="text-sm text-muted-foreground max-w-[200px]">
                Enter a room code to join your friends.
              </p>
            </div>
          </button>
        </div>

        {/* Join Room Modal */}
        {joining && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in-up">
            <div className="p-8 bg-card/70 border border-border/50 rounded-2xl shadow-lg max-w-sm w-full text-center">
              <h3 className="font-heading text-xl mb-4 flex items-center justify-center gap-2">
                <KeyRound className="w-5 h-5 text-primary" /> Enter Room Code
              </h3>
              <Input
                placeholder="e.g. A1B2C3"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="mb-4 text-center uppercase"
                maxLength={6}
              />
              <div className="flex gap-3 justify-center">
                <Button variant="neonCyan" onClick={handleJoinRoom}>
                  Join
                </Button>
                <Button variant="ghost" onClick={() => setJoining(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="absolute bottom-6 left-0 right-0 flex justify-center gap-6 text-xs text-muted-foreground animate-fade-in-up"
        style={{ animationDelay: "1s" }}
      >
        <Link to="/terms" className="hover:text-primary transition-colors">
          Terms of Service
        </Link>
        <span className="text-muted-foreground/30">•</span>
        <Link to="/privacy" className="hover:text-primary transition-colors">
          Privacy Policy
        </Link>
        <span className="text-muted-foreground/30">•</span>
        <Link to="/about" className="hover:text-primary transition-colors">
          About
        </Link>
      </div>
    </section>
  );
};

export default Index;
