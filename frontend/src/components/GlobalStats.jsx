import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Users, Gamepad2, Eye } from "lucide-react";

const GlobalStats = () => {
  const [stats, setStats] = useState({ games: 0, players: 0, online: 1 });

  useEffect(() => {
    // 1) Fetch initial stats
    const fetchStats = async () => {
      const { data } = await supabase.from("global_stats").select("*").single();
      if (data) {
        setStats((prev) => ({
          ...prev,
          games: data.total_games_played,
          players: data.total_players_joined,
        }));
      }
    };

    fetchStats();

    // 2) Subscribe to live updates
    const channel = supabase
      .channel("global_stats_changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "global_stats" },
        (payload) => {
          setStats((prev) => ({
            ...prev,
            games: payload.new.total_games_played,
            players: payload.new.total_players_joined,
          }));
        }
      )
      .subscribe();

    // 3) Track "Online Now" using Presence (approx)
    const presenceChannel = supabase
      .channel("online_users_global")
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const count = Object.keys(state).length;
        setStats((prev) => ({ ...prev, online: Math.max(1, count) }));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, []);

  // Compact, low-focus UI (doesn't compete with the hero section)
  return (
    <div className="flex items-center justify-center">
      <div className="flex flex-wrap items-center justify-center gap-3 px-4 py-2 rounded-full bg-card/20 backdrop-blur-md border border-border/30 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Gamepad2 className="w-3.5 h-3.5" />
          <span className="font-semibold text-foreground/90">
            {stats.games.toLocaleString()}
          </span>
          <span className="hidden sm:inline">games</span>
        </div>

        <span className="hidden sm:inline text-muted-foreground/40">•</span>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <span className="font-semibold text-foreground/90">
            {stats.players.toLocaleString()}
          </span>
          <span className="hidden sm:inline">players</span>
        </div>

        <span className="hidden md:inline text-muted-foreground/40">•</span>

        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
          <Eye className="w-3.5 h-3.5" />
          <span className="font-semibold text-foreground/90">
            {stats.online.toLocaleString()}
          </span>
          <span>online</span>
        </div>
      </div>
    </div>
  );
};

export default GlobalStats;
