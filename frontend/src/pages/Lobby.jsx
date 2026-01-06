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
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabaseClient";
import { useRoomPresence } from "@/lib/useRoomPresence";
import { useMusic } from "@/contexts/MusicContext";
import AvatarEditor from "@/components/AvatarEditor"; // Import the Editor
import { generateAvatarFromSeed } from "@/lib/avatarUtils"; // Import deterministic generator
import { toast } from "sonner"; // Import Sonner

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
  const [isLoading, setIsLoading] = useState(true);

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
       toast.error("Failed to save changes.");
    } else {
       toast.success("Profile updated!");
    }
  };

  // 🔁 Fetch room info & participants
  useEffect(() => {
    let currentRoomId = null;

    const fetchRoomData = async () => {
      setIsLoading(true);
      const { data: roomData, error: roomErr } = await supabase
        .from("game_rooms")
        .select(
          "id, room_code, host_id, status, current_round, created_at, settings"
        )
        .eq("room_code", roomCode?.toUpperCase())
        .single();

      if (roomErr || !roomData) {
        console.error("Room not found", roomErr);
        toast.error("Room not found or inaccessible.");
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
      setIsLoading(false);

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
      toast.error("Missing profile. Please re-join the room.");
      return;
    }

    // Set loading immediately to prevent double clicks
    setIsLoading(true);

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
        toast.error("Failed to start game. Please try again.");
        setIsLoading(false); // Reset loading on error
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
      toast.error("Failed to start game.");
      setIsLoading(false); // Reset loading on error
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

  // 🛡️ Loading State Guard (Fix for Issue #2: Blank Screen)
  // If we are loading, show a full screen skeleton instead of partially rendering
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background gradient-mesh flex items-center justify-center">
         <div className="container max-w-5xl mx-auto px-4 space-y-8 animate-pulse">
            {/* Header Skeleton */}
            <div className="flex justify-between items-center h-12">
               <Skeleton className="h-10 w-24 rounded-lg bg-primary/10" />
               <Skeleton className="h-10 w-32 rounded-lg bg-primary/10" />
            </div>
            
            {/* Main Grid Skeleton */}
            <div className="grid lg:grid-cols-2 gap-8">
               <Skeleton className="h-[400px] w-full rounded-2xl bg-card/50" />
               <div className="space-y-4">
                  <Skeleton className="h-16 w-full rounded-xl bg-card/50" />
                  <Skeleton className="h-16 w-full rounded-xl bg-card/50" />
                  <Skeleton className="h-16 w-full rounded-xl bg-card/50" />
               </div>
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background gradient-mesh">
      <div className="container max-w-5xl mx-auto px-4 py-4 sm:py-8 pb-20 sm:pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between mb-6 sm:mb-8 gap-4 sm:gap-0 animate-fade-in-up">
          <Button
            variant="ghost"
            size="sm"
            className="self-start sm:self-auto gap-2 text-muted-foreground hover:text-foreground"
            onClick={handleLeaveRoom}
          >
            <ArrowLeft className="w-4 h-4" /> Exit
          </Button>

          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto">
            {/* Room Code */}
            <div className="flex items-center justify-between w-full sm:w-auto gap-3 bg-card border border-border rounded-xl px-4 py-2 shadow-sm">
              <span className="text-muted-foreground font-mono text-xs sm:text-sm">
                CODE:
              </span>
              <div className="flex items-center gap-2">
                <span className="font-heading font-bold text-primary tracking-widest text-lg sm:text-xl">
                  {roomCode?.toUpperCase()}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 sm:h-8 sm:w-8 hover:bg-primary/10 hover:text-primary rounded-full"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Shareable Link Button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto gap-2 border-primary/20 hover:bg-primary/5 hover:border-primary/40 text-xs sm:text-sm h-10 sm:h-9"
              onClick={handleCopyLink}
            >
              {linkCopied ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4" />
                  Invite Link
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
          {/* ⚙️ Game Settings */}
          {currentIsHost ? (
            <div className="space-y-4 sm:space-y-6 bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-4 sm:p-6 shadow-inner animate-fade-in-up order-2 lg:order-1">
              <div className="flex items-center gap-2 mb-2 sm:mb-4 border-b border-border/30 pb-3">
                <Settings className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-heading font-bold">
                  Game Settings
                </h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">No. of Traitors</span>
                  <Select
                    value={settings.traitors.toString()}
                    onValueChange={(v) =>
                      updateGameSettings({ ...settings, traitors: parseInt(v) })
                    }
                  >
                    <SelectTrigger className="w-24 h-9 bg-background/50 border-border/40 text-sm">
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
                  <span className="text-sm font-medium">Hint Time (sec)</span>
                  <Select
                    value={settings.hintTime.toString()}
                    onValueChange={(v) =>
                      updateGameSettings({ ...settings, hintTime: parseInt(v) })
                    }
                  >
                    <SelectTrigger className="w-24 h-9 bg-background/50 border-border/40 text-sm">
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
                  <span className="text-sm font-medium">Difficulty</span>
                  <Select
                    value={settings.wordLevel}
                    onValueChange={(v) =>
                      updateGameSettings({ ...settings, wordLevel: v })
                    }
                  >
                    <SelectTrigger className="w-28 h-9 bg-background/50 border-border/40 text-sm">
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

                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-medium">18+ Words</span>
                  <Switch
                    checked={settings.adultWords}
                    onCheckedChange={(val) =>
                      updateGameSettings({ ...settings, adultWords: val })
                    }
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Anonymous Voting</span>
                  <Switch
                    checked={settings.anonymousVoting}
                    onCheckedChange={(val) =>
                      updateGameSettings({ ...settings, anonymousVoting: val })
                    }
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
              </div>
            </div>
          ) : (
            // Non-host view of settings
            <div className="space-y-4 bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-6 shadow-inner animate-fade-in-up order-2 lg:order-1 opacity-75">
               <div className="flex items-center gap-2 mb-4 border-b border-border/30 pb-3">
                <Settings className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-lg font-heading font-bold text-muted-foreground">
                  Room Settings
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                 <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wider opacity-70">Traitors</span>
                    <span className="font-mono font-bold text-foreground">{settings.traitors}</span>
                 </div>
                 <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wider opacity-70">Difficulty</span>
                    <span className="font-mono font-bold text-foreground capitalize">{settings.wordLevel}</span>
                 </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wider opacity-70">Hint Time</span>
                    <span className="font-mono font-bold text-foreground">{settings.hintTime}s</span>
                 </div>
                 <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wider opacity-70">Voting</span>
                    <span className="font-mono font-bold text-foreground">{settings.anonymousVoting ? 'Anonymous' : 'Public'}</span>
                 </div>
              </div>
              <p className="text-xs text-center text-muted-foreground/50 mt-4 italic">Waiting for host to start...</p>
            </div>
          )}

          {/* 👥 Player List */}
          <div className="space-y-4 animate-fade-in-up flex flex-col h-full order-1 lg:order-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-lg font-heading font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-secondary" /> Players (
                {players.length})
              </h2>
            </div>

            <div className="flex-1 min-h-[300px] max-h-[50vh] lg:max-h-[60vh] overflow-y-auto space-y-3 bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-4 sm:p-6 custom-scrollbar">
              {players.map((p, i) => {
                 const isMe = p.user_id === profileId;
                 
                 // ✅ FIX: Use our new deterministic generator
                 // This ensures the same config is generated for the same username every time
                 // even across re-renders
                 const avatarConfig = p.profiles?.avatar_config && Object.keys(p.profiles.avatar_config).length > 0
                    ? p.profiles.avatar_config
                    : generateAvatarFromSeed(p.profiles?.username || p.user_id);

                 return (
                  <div
                    key={p.id || i}
                    className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border/40 transition-all hover:bg-background/80 hover:border-primary/20"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                      {/* Avatar Display - Clickable if isMe */}
                      <div 
                        className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-border/50 bg-secondary/10 shrink-0 ${isMe ? 'cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all' : ''}`}
                        onClick={() => isMe && setIsEditorOpen(true)}
                      >
                         <Avatar 
                           style={{ width: '100%', height: '100%' }} 
                           {...avatarConfig} 
                         />
                      </div>
                      
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-base sm:text-lg truncate max-w-[120px] sm:max-w-[200px]">{p.profiles?.username}</span>
                        {isMe && (
                           <button 
                              onClick={() => setIsEditorOpen(true)}
                              className="text-xs text-primary flex items-center gap-1 hover:underline self-start"
                           >
                              <Edit2 className="w-3 h-3" /> Customize
                           </button>
                        )}
                      </div>
                    </div>

                    {p.user_id === room?.host_id && (
                      <span className="text-[10px] sm:text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-bold uppercase tracking-wider shrink-0">
                        Host
                      </span>
                    )}
                  </div>
                 );
              })}
              
              {players.length === 0 && (
                 <div className="text-center py-8 text-muted-foreground opacity-50">
                    Waiting for players...
                 </div>
              )}
            </div>

            {/* Invite & Start - Fixed at bottom on mobile or stacked */}
            <div className="flex flex-col gap-4 sticky bottom-0 z-10 pt-2 lg:pt-0 lg:static">
              {/* Start Game Button (Host Only) */}
              {currentIsHost ? (
                <Button
                  variant="neonCyan"
                  size="xl"
                  className="w-full gap-2 py-6 text-lg shadow-lg shadow-cyan-500/20"
                  onClick={handleStartGame}
                  disabled={isLoading} // Disable while loading
                >
                  <Play className="w-6 h-6 fill-current" />
                  START GAME
                </Button>
              ) : (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center animate-pulse">
                   <p className="text-primary font-semibold text-sm">Waiting for host to start the game...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
