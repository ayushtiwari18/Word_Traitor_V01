import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Settings,
  HelpCircle,
  Users,
  PlusCircle,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient"; // ensure supabase client is configured

// Generate a random 6-letter room code
const generateRoomCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
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
  const [playerName, setPlayerName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const navigate = useNavigate();

  // Helper to get or create profile
  const getOrCreateProfile = async (username) => {
    const { data, error } = await supabase
      .from("profiles")
      .upsert({ username }, { onConflict: "username" })
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

      // 1️⃣ Create room
      const { data: room, error: roomError } = await supabase
        .from("game_rooms")
        .insert({
          room_code: roomCode,
          status: "waiting",
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // 2️⃣ Create profile
      const profile = await getOrCreateProfile(playerName);

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

      // ✅ Redirect to lobby
      navigate(`/lobby/${roomCode}`, {
        state: { playerName, isHost: true, roomCode },
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

      // ✅ Redirect to lobby
      navigate(`/lobby/${code}`, {
        state: { playerName, isHost: false, roomCode: code },
      });
    } catch (err) {
      console.error("Error joining room:", err);
      alert("Failed to join room. Check console for details.");
    }
  };

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 gradient-mesh">
      <ParticleBackground />

      {/* Top icons */}
      <div
        className="absolute top-6 right-6 flex items-center gap-3 animate-fade-in-up"
        style={{ animationDelay: "0.8s" }}
      >
        <Link to="/settings">
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
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default Index;
