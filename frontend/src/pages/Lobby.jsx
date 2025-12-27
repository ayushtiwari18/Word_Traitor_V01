import { useEffect, useState } from "react";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, Settings, Play, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabaseClient";

const Lobby = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { playerName, isHost } = location.state || {};

  const [copied, setCopied] = useState(false);
  const [players, setPlayers] = useState([]);
  const [room, setRoom] = useState(null);
  const [settings, setSettings] = useState({
    traitors: 1,
    hintTime: 30,
    wordLevel: "medium",
    adultWords: false,
    anonymousVoting: false,
  });

  // 🔧 Update settings in Supabase when host changes them
  const updateGameSettings = async (newSettings) => {
    setSettings(newSettings);

    if (isHost && room) {
      const { error } = await supabase
        .from("game_rooms")
        .update({ settings: newSettings })
        .eq("id", room.id);

      if (error) console.error("❌ Failed to update settings:", error);
    }
  };

  // 🔁 Fetch room info & participants
  useEffect(() => {
    const fetchRoomData = async () => {
      const { data: roomData, error: roomErr } = await supabase
        .from("game_rooms")
        .select("*")
        .eq("room_code", roomCode?.toUpperCase())
        .single();

      if (roomErr || !roomData) {
        console.error("Room not found", roomErr);
        alert("Room not found or inaccessible.");
        navigate("/");
        return;
      }

      setRoom(roomData);
      if (roomData.settings) setSettings(roomData.settings);

      const { data: participants, error: partErr } = await supabase
        .from("room_participants")
        .select("*, profiles!room_participants_user_id_fkey(username)")
        .eq("room_id", roomData.id);

      if (partErr) console.error("Error loading participants:", partErr);
      setPlayers(participants || []);
    };

    fetchRoomData();

    // Realtime subscription for participant updates
    const subscription = supabase
      .channel(`room_${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_participants",
        },
        () => fetchRoomData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [roomCode]);

  // 🧠 Copy room code
  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode?.toUpperCase());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 🚀 Start Game (only host)
  const handleStartGame = async () => {
    if (!isHost || !room) return;

    // update status to 'playing' & save final settings
    const { error } = await supabase
      .from("game_rooms")
      .update({
        status: "playing",
        settings,
      })
      .eq("id", room.id);

    if (error) {
      console.error("Error starting game:", error);
      alert("Failed to start game.");
      return;
    }

    // 🔀 redirect to word reveal page (next phase)
    navigate(`/word/${roomCode}`, { state: { playerName, isHost } });
  };

  return (
    <div className="min-h-screen bg-background gradient-mesh">
      <div className="container max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in-up">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Exit
            </Button>
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-muted-foreground font-mono text-sm">
              Room Code:
            </span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border">
              <span className="font-heading font-bold text-primary tracking-wider">
                {roomCode?.toUpperCase()}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* ⚙️ Game Settings */}
          <div className="space-y-6 bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-6 shadow-inner animate-fade-in-up">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-heading font-bold">Game Settings</h2>
            </div>

            <div className="flex items-center justify-between">
              <span>No. of Traitors</span>
              <Select
                value={settings.traitors.toString()}
                onValueChange={(v) =>
                  updateGameSettings({ ...settings, traitors: parseInt(v) })
                }
              >
                <SelectTrigger className="w-24 bg-background/50 border-border/40">
                  <SelectValue placeholder="1" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <span>Hint Drop Timing (sec)</span>
              <Select
                value={settings.hintTime.toString()}
                onValueChange={(v) =>
                  updateGameSettings({ ...settings, hintTime: parseInt(v) })
                }
              >
                <SelectTrigger className="w-28 bg-background/50 border-border/40">
                  <SelectValue placeholder="30" />
                </SelectTrigger>
                <SelectContent>
                  {[30, 45, 60, 90].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <span>Level of Words</span>
              <Select
                value={settings.wordLevel}
                onValueChange={(v) =>
                  updateGameSettings({ ...settings, wordLevel: v })
                }
              >
                <SelectTrigger className="w-28 bg-background/50 border-border/40">
                  <SelectValue placeholder="Medium" />
                </SelectTrigger>
                <SelectContent>
                  {["easy", "medium", "hard"].map((lvl) => (
                    <SelectItem key={lvl} value={lvl}>
                      {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <span>18+ Words</span>
              <Switch
                checked={settings.adultWords}
                onCheckedChange={(val) =>
                  updateGameSettings({ ...settings, adultWords: val })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <span>Anonymous Voting</span>
              <Switch
                checked={settings.anonymousVoting}
                onCheckedChange={(val) =>
                  updateGameSettings({ ...settings, anonymousVoting: val })
                }
              />
            </div>
          </div>

          {/* 👥 Player List */}
          <div className="space-y-4 animate-fade-in-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-heading font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-secondary" /> Players (
                {players.length})
              </h2>
            </div>

            <div className="space-y-3 bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-6">
              {players.map((p, i) => (
                <div
                  key={p.id || i}
                  className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center text-sm font-bold">
                      {p.profiles?.username?.charAt(0)?.toUpperCase()}
                    </div>
                    <span>{p.profiles?.username}</span>
                  </div>
                  {p.user_id === room?.host_id && (
                    <span className="text-xs text-primary font-semibold">
                      Host
                    </span>
                  )}
                </div>
              ))}
            </div>

            {isHost && (
              <div className="mt-6 text-center">
                <Button
                  variant="neonCyan"
                  size="xl"
                  className="min-w-[250px] gap-2"
                  onClick={handleStartGame}
                >
                  <Play className="w-5 h-5" />
                  Start Game
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
