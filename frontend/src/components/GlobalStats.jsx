import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Users, Gamepad2, Eye } from "lucide-react";

const GlobalStats = () => {
  const [stats, setStats] = useState({ games: 0, players: 0, online: 1 });

  useEffect(() => {
    // 1. Fetch initial stats
    const fetchStats = async () => {
      const { data } = await supabase
        .from('global_stats')
        .select('*')
        .single();
      
      if (data) {
        setStats(prev => ({
          ...prev,
          games: data.total_games_played,
          players: data.total_players_joined
        }));
      }
    };

    fetchStats();

    // 2. Subscribe to live updates
    const channel = supabase
      .channel('global_stats_changes')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'global_stats' }, 
        (payload) => {
          setStats(prev => ({
            ...prev,
            games: payload.new.total_games_played,
            players: payload.new.total_players_joined
          }));
        }
      )
      .subscribe();
      
    // 3. Track "Online Now" using Presence
    const presenceChannel = supabase.channel('online_users_global')
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        // Count unique presences (each client gets a random UUID usually, or we track by session)
        const count = Object.keys(state).length; 
        setStats(prev => ({ ...prev, online: Math.max(1, count) }));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, []);

  return (
    <div className="flex flex-wrap gap-6 md:gap-12 justify-center items-center py-6 animate-fade-in-up mt-8 bg-card/20 backdrop-blur-sm rounded-2xl px-8 border border-white/5">
      {/* Total Games */}
      <div className="flex flex-col items-center group min-w-[100px]">
        <div className="flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors mb-1">
          <Gamepad2 className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wider font-bold">Games Played</span>
        </div>
        <span className="text-3xl md:text-4xl font-heading font-bold text-glow-cyan transition-all group-hover:scale-110">
          {stats.games.toLocaleString()}
        </span>
      </div>

      <div className="hidden md:block w-px h-12 bg-border/30" />

      {/* Total Players */}
      <div className="flex flex-col items-center group min-w-[100px]">
        <div className="flex items-center gap-2 text-muted-foreground group-hover:text-secondary transition-colors mb-1">
          <Users className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wider font-bold">Players Joined</span>
        </div>
        <span className="text-3xl md:text-4xl font-heading font-bold text-glow-purple transition-all group-hover:scale-110">
          {stats.players.toLocaleString()}
        </span>
      </div>

      <div className="hidden md:block w-px h-12 bg-border/30" />

      {/* Online Now */}
      <div className="flex flex-col items-center group min-w-[100px]">
        <div className="flex items-center gap-2 text-muted-foreground group-hover:text-green-400 transition-colors mb-1">
          <Eye className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wider font-bold">Online Now</span>
        </div>
        <span className="text-3xl md:text-4xl font-heading font-bold text-green-400 transition-all group-hover:scale-110">
          {stats.online.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

export default GlobalStats;
