import { useEffect, useState } from "react";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Copy,
  Check,
  Settings,
  Play,
  Users,
  Link2,
} from "lucide-react";

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

  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
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
    let roomId = null;

    const fetchRoomData = async () => {
      const { data: roomData, error: roomErr } = await supabase
        .from("game_rooms")
        .select(
          "id, room_code, host_id, status, current_round, created_at, settings"
        )
        .eq("room_code", roomCode?.toUpperCase())
        .single();

      if (roomErr || !roomData) {
        console.error("Room not found", roomErr);
        alert("Room not found or inaccessible.");
        navigate("/");
        return;
      }

      roomId = roomData.id;
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

    // Single channel for all realtime updates
    const channel = supabase
      .channel(`lobby_${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_participants",
        },
        (payload) => {
          console.log("🔄 Participant change detected:", payload);
          // Only refetch if it's for our room
          if (
            !roomId ||
            payload.new?.room_id === roomId ||
            payload.old?.room_id === roomId
          ) {
            fetchRoomData();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_rooms",
        },
        (payload) => {
          console.log("🎮 Game room updated:", payload);
          if (
            payload.new?.room_code === roomCode?.toUpperCase() &&
            payload.new?.status === "playing"
          ) {
            navigate(`/word/${roomCode}`, {
              state: { playerName, isHost, profileId },
            });
          }
        }
      )
      .subscribe((status, err) => {
        console.log("📡 Realtime subscription status:", status, err);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, navigate, playerName, isHost, profileId]);

  // 🧠 Copy room code
  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode?.toUpperCase());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 🔗 Copy shareable link
  const handleCopyLink = () => {
    const shareableLink = `${
      window.location.origin
    }/?room=${roomCode?.toUpperCase()}`;
    navigator.clipboard.writeText(shareableLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // 🚀 Start Game (only host)
  const handleStartGame = async () => {
    if (!isHost || !room) return;
    if (!profileId) {
      alert("Missing profile. Please re-join the room.");
      return;
    }

    try {
      // Call edge function to assign words and roles
      const { data, error: fnError } = await supabase.functions.invoke(
        "start-round",
        {
          body: {
            roomId: room.id,
            settings,
            profileId,
          },
        }
      );

      if (fnError) {
        console.error("Error calling start-round:", fnError);
        alert("Failed to start game. Please try again.");
        return;
      }

      console.log("🎮 Game started:", data);

      // update status to 'playing' & save final settings (edge function already does this, but ensure it)
      const { error } = await supabase
        .from("game_rooms")
        .update({
          status: "playing",
          settings,
        })
        .eq("id", room.id);

      if (error) {
        console.error("Error updating game status:", error);
      }

      // 🔀 redirect to word reveal page (next phase)
      navigate(`/word/${roomCode}`, {
        state: { playerName, isHost, profileId },
      });
    } catch (err) {
      console.error("Error starting game:", err);
      alert("Failed to start game.");
    }
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

          <div className="flex items-center gap-4">
            {/* Room Code */}
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

            {/* Shareable Link */}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleCopyLink}
            >
              {linkCopied ? (
                <>
                  <Check className="w-4 h-4" />
                  Link Copied!
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4" />
                  Share Link
                </>
              )}
            </Button>
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
            {/* Add this NEW section after the players list */}
            <div className="bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary" />
                Invite Players
              </h3>

              <div className="space-y-3">
                <div className="bg-background/50 rounded-lg p-3 border border-border/40">
                  <div className="text-xs text-muted-foreground truncate font-mono">
                    {`${
                      window.location.origin
                    }/?room=${roomCode?.toUpperCase()}`}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={handleCopyLink}
                >
                  {linkCopied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Link Copied!
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4" />
                      Copy Invite Link
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Share this link with friends to join directly
                </p>
              </div>
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
