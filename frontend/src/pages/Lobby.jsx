import { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Copy,
  Check,
  Settings,
  Play,
  Users,
  Link2,
  Edit2, // Added Edit Icon
} from "lucide-react";
import Avatar, { genConfig } from "react-nice-avatar"; // Import Avatar

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
import { useRoomPresence } from "@/lib/useRoomPresence";
import { useMusic } from "@/contexts/MusicContext";
import AvatarEditor from "@/components/AvatarEditor"; // Import the Editor
import { generateAvatarFromSeed } from "@/lib/avatarUtils"; // Import deterministic generator
import { cn } from "@/lib/utils";

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
  const [currentIsHost, setCurrentIsHost] = useState(isHost || false);
  const { setPhase } = useMusic();

  // Avatar Editing State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [myAvatarConfig, setMyAvatarConfig] = useState(null);

  // 🎵 Set Music Phase
  useEffect(() => {
    setPhase('lobby');
  }, [setPhase]);

  const redirectByStatus = (roomData) => {
    if (!roomData?.status || !roomCode) return;
    if (!profileId) return;

    const computedIsHost = !!(roomData.host_id && roomData.host_id === profileId);

    // Keep lobby only for waiting state.
    if (roomData.status === "playing") {
      navigate(`/word/${roomCode}`, {
        state: { playerName, isHost: computedIsHost, profileId },
      });
      return;
    }

    if (roomData.status === "hint_drop") {
      navigate(`/hint/${roomCode}`, {
        state: { playerName, isHost: computedIsHost, profileId },
      });
      return;
    }

    if (roomData.status === "discussion" || roomData.status === "finished") {
      navigate(`/discussion/${roomCode}`, {
        state: { playerName, isHost: computedIsHost, profileId },
      });
    }
  };

  // 📡 PRESENCE HOOK: Handles host transfer & ghost cleanup
  useRoomPresence(roomCode, room?.id, profileId, currentIsHost);

  // 🔧 Update settings in Supabase when host changes them
  const updateGameSettings = async (newSettings) => {
    // 1. Optimistic update (host sees change instantly)
    setSettings(newSettings);

    if (currentIsHost && room) {
      // 2. Write to DB
      const { error } = await supabase
        .from("game_rooms")
        .update({ settings: newSettings })
        .eq("id", room.id);

      if (error) {
        console.error("❌ Failed to update settings:", error);
      }
    }
  };

  // Save Avatar & Name Changes
  const handleSaveAvatar = async (newConfig, newName) => {
    if (!profileId) return;
    
    // Update local state for instant feedback
    setMyAvatarConfig(newConfig);
    
    // Update DB
    const { error } = await supabase
      .from("profiles")
      .update({ 
        avatar_config: newConfig,
        username: newName 
      })
      .eq("id", profileId);

    if (error) {
       console.error("Failed to update profile", error);
       alert("Failed to save changes.");
    }
  };

  // 🔁 Fetch room info & participants
  useEffect(() => {
    let currentRoomId = null;

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

      currentRoomId = roomData.id;
      setRoom(roomData);
      
      // ✅ Initial sync: Apply DB settings
      if (roomData.settings) {
        setSettings(roomData.settings);
      }
      
      if (profileId && roomData.host_id === profileId) {
        setCurrentIsHost(true);
      } else {
        setCurrentIsHost(false);
      }

      // 🔀 If the game already started (or advanced), jump to the right phase.
      // This prevents players (and especially the host) getting stuck in Lobby.
      redirectByStatus(roomData);

      // Fetch participants with their updated avatar configs
      const { data: participants, error: partErr } = await supabase
        .from("room_participants")
        .select("*, profiles!room_participants_user_id_fkey(username, avatar_config)")
        .eq("room_id", roomData.id);

      if (partErr) console.error("Error loading participants:", partErr);
      setPlayers(participants || []);

      // Set my initial avatar config from the list if available
      const me = participants?.find(p => p.user_id === profileId);
      if (me?.profiles?.avatar_config && Object.keys(me.profiles.avatar_config).length > 0) {
         setMyAvatarConfig(me.profiles.avatar_config);
      } else if (!myAvatarConfig) {
         // Use the helper to generate a seed-based one initially
         const newConfig = generateAvatarFromSeed(me?.profiles?.username || "default");
         setMyAvatarConfig(newConfig);
      }
    };

    fetchRoomData();

    // Single channel for all realtime updates
    const channel = supabase
      .channel(`lobby_${roomCode}_${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_participants",
        },
        () => fetchRoomData() // Refresh list on join/leave
      )
      // Listen for PROFILE updates (name/avatar changes)
      .on(
        "postgres_changes", 
        { 
           event: "UPDATE", 
           schema: "public", 
           table: "profiles" 
        }, 
        () => {
           console.log("👤 Profile updated, refreshing list...");
           fetchRoomData();
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
          
          if (payload.new?.room_code === roomCode?.toUpperCase()) {
            // ✅ DIRECT SYNC: Apply settings from payload immediately
            if (payload.new.settings) {
              setSettings(payload.new.settings);
            }
            
            // Also update room state (host_id, status etc)
            setRoom(prev => ({ ...(prev || {}), ...payload.new }));
            
            if (profileId && payload.new.host_id === profileId) {
                setCurrentIsHost(true);
            } else {
                setCurrentIsHost(false);
            }

            redirectByStatus(payload.new);
          }
        }
      )
      .subscribe((status) => {
        console.log("📡 Realtime subscription status:", status);
      });

    return () => {
      console.log("🧹 Cleaning up subscription");
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
    if (!currentIsHost || !room) return;
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
            settings, // ✅ Pass current synced settings
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

      // Increment Global Stats for games played
      await supabase.rpc('increment_games_played');

      // 🔀 redirect to word reveal page (next phase)
      navigate(`/word/${roomCode}`, {
        state: { playerName, currentIsHost, profileId },
      });
    } catch (err) {
      console.error("Error starting game:", err);
      alert("Failed to start game.");
    }
  };

  // 🚪 Leave room and cleanup
  const handleLeaveRoom = async () => {
    if (!profileId || !room) {
      navigate("/");
      return;
    }
    try {
      // Delete participant from room FIRST
      const { error: deleteError } = await supabase
        .from("room_participants")
        .delete()
        .eq("room_id", room.id)
        .eq("user_id", profileId);

      if (deleteError) {
        console.error("Error leaving room:", deleteError);
      }

      // 🔥 NEW: Get FRESH participant list after deletion
      const { data: remainingPlayers, error: remainingErr } = await supabase
        .from("room_participants")
        .select("*")
        .eq("room_id", room.id);

      if (remainingErr) {
        console.error("Error fetching remaining players:", remainingErr);
      }

      // 🔥 NEW: Handle host transfer/deletion based on FRESH data
      if (currentIsHost) {
        if (!remainingPlayers || remainingPlayers.length === 0) {
          // No one left → delete room
          await supabase.from("game_rooms").delete().eq("id", room.id);
        } else {
          // Promote FIRST remaining player to host
          const newHost = remainingPlayers[0];
          await supabase
            .from("game_rooms")
            .update({ host_id: newHost.user_id })
            .eq("id", room.id);
          console.log("👑 New host:", newHost.user_id);
        }
      }

      localStorage.removeItem(`profile_id_${roomCode?.toUpperCase()}`);
      navigate("/");
    } catch (err) {
      console.error("Error in handleLeaveRoom:", err);
      navigate("/");
    }
  };

  return (
    <div className={cn("min-h-screen bg-background gradient-mesh pb-24 lg:pb-8")}>
      <div className="container max-w-5xl mx-auto px-4 py-6 sm:py-8">
        {/* Header - Mobile Optimized */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8 animate-fade-in-up">
          
          {/* Top Row: Exit & Room Code (Mobile split) */}
          <div className="w-full sm:w-auto flex items-center justify-between gap-4">
             <Button
              variant="ghost"
              size="sm"
              className="gap-2 -ml-2 sm:ml-0"
              onClick={handleLeaveRoom}
            >
              <ArrowLeft className="w-4 h-4" /> Exit
            </Button>
            
            {/* Mobile-only Link Share Button (Small) */}
             <Button
              variant="outline"
              size="icon"
              className="sm:hidden h-8 w-8"
              onClick={handleCopyLink}
            >
              {linkCopied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full sm:w-auto">
            {/* Room Code */}
            <div className="flex-1 sm:flex-none flex items-center justify-between sm:justify-start gap-3 bg-card border border-border px-3 py-2 rounded-lg w-full sm:w-auto">
              <span className="text-muted-foreground font-mono text-sm whitespace-nowrap">
                Room Code:
              </span>
              <div className="flex items-center gap-2">
                <span className="font-heading font-bold text-primary tracking-wider text-lg">
                  {roomCode?.toUpperCase()}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-primary" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Desktop Link Share Button */}
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex gap-2"
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
        <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
          {/* ⚙️ Game Settings */}
          {currentIsHost && (
            <div className="order-2 lg:order-1 space-y-5 bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-5 sm:p-6 shadow-inner animate-fade-in-up">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-heading font-bold">
                  Game Settings
                </h2>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm sm:text-base">No. of Traitors</span>
                <Select
                  value={settings.traitors.toString()}
                  onValueChange={(v) =>
                    updateGameSettings({ ...settings, traitors: parseInt(v) })
                  }
                >
                  <SelectTrigger className="w-24 bg-background/50 border-border/40 h-9 sm:h-10">
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
                <span className="text-sm sm:text-base">Hint Drop Time (sec)</span>
                <Select
                  value={settings.hintTime.toString()}
                  onValueChange={(v) =>
                    updateGameSettings({ ...settings, hintTime: parseInt(v) })
                  }
                >
                  <SelectTrigger className="w-28 bg-background/50 border-border/40 h-9 sm:h-10">
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
                <span className="text-sm sm:text-base">Word Difficulty</span>
                <Select
                  value={settings.wordLevel}
                  onValueChange={(v) =>
                    updateGameSettings({ ...settings, wordLevel: v })
                  }
                >
                  <SelectTrigger className="w-28 bg-background/50 border-border/40 h-9 sm:h-10">
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
                <span className="text-sm sm:text-base">18+ Words</span>
                <Switch
                  checked={settings.adultWords}
                  onCheckedChange={(val) =>
                    updateGameSettings({ ...settings, adultWords: val })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm sm:text-base">Anonymous Voting</span>
                <Switch
                  checked={settings.anonymousVoting}
                  onCheckedChange={(val) =>
                    updateGameSettings({ ...settings, anonymousVoting: val })
                  }
                />
              </div>
            </div>
          )}
          
          {/* 👥 Player List */}
          <div className="order-1 lg:order-2 space-y-4 animate-fade-in-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-heading font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-secondary" /> Players (
                {players.length})
              </h2>
            </div>

            <div className="space-y-3 bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-5 sm:p-6">
              {players.map((p, i) => {
                 const isMe = p.user_id === profileId;
                 
                 const avatarConfig = p.profiles?.avatar_config && Object.keys(p.profiles.avatar_config).length > 0
                    ? p.profiles.avatar_config
                    : generateAvatarFromSeed(p.profiles?.username || p.user_id);

                 return (
                  <div
                    key={p.id || i}
                    className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border/40"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      {/* Avatar Display */}
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-border/50 bg-secondary/10 shrink-0">
                         <Avatar 
                           style={{ width: '100%', height: '100%' }} 
                           {...avatarConfig} 
                         />
                      </div>
                      
                      <div className="flex flex-col">
                        <span className="font-semibold text-base sm:text-lg">{p.profiles?.username}</span>
                        {isMe && (
                           <button 
                              onClick={() => setIsEditorOpen(true)}
                              className="text-xs text-primary flex items-center gap-1 hover:underline mt-0.5"
                           >
                              <Edit2 className="w-3 h-3" /> Customize
                           </button>
                        )}
                      </div>
                    </div>

                    {p.user_id === room?.host_id && (
                      <span className="text-[10px] sm:text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-bold">
                        HOST
                      </span>
                    )}
                  </div>
                 );
              })}
            </div>

            {/* Invite Players Card */}
            <div className="bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-5 sm:p-6">
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
                  className="w-full gap-2 h-10 sm:h-9"
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

            {/* Start Game Button - Desktop (Inline) */}
            {currentIsHost && (
              <div className="mt-6 text-center hidden md:block">
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

      {/* Start Game Button - Mobile Sticky Footer */}
      {currentIsHost && (
        <div className="md:hidden fixed bottom-0 left-0 w-full p-4 bg-background/80 backdrop-blur-lg border-t border-border/50 z-40 animate-in slide-in-from-bottom-5">
           <Button
              variant="neonCyan"
              size="lg"
              className="w-full gap-2 shadow-lg shadow-primary/20"
              onClick={handleStartGame}
            >
              <Play className="w-5 h-5" />
              Start Game
            </Button>
        </div>
      )}

      {/* Avatar Editor Dialog */}
      <AvatarEditor 
        isOpen={isEditorOpen} 
        onClose={() => setIsEditorOpen(false)}
        initialConfig={myAvatarConfig}
        initialName={players.find(p => p.user_id === profileId)?.profiles?.username}
        onSave={handleSaveAvatar}
      />
    </div>
  );
};

export default Lobby;
