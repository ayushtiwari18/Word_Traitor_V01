import React from 'react';
import { useMusic } from '@/contexts/MusicContext';
import { Music, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const MusicPlayerWidget = () => {
  const { isPlaying, toggleMusic, volume, setVolume, currentPhase } = useMusic();

  return (
    <div className="fixed bottom-6 left-6 z-50 hidden lg:flex items-center gap-2 group">
      {/* Volume Slider (Revealed on Hover) */}
      <div className="w-0 overflow-hidden group-hover:w-32 transition-all duration-300 ease-out bg-slate-900/80 backdrop-blur-md rounded-full border border-cyan-500/20 shadow-lg shadow-cyan-500/10">
         <div className="p-3">
           <Slider
             defaultValue={[volume]}
             max={1}
             step={0.01}
             onValueChange={(val) => setVolume(val[0])}
             className="w-24 cursor-pointer"
           />
         </div>
      </div>

      {/* Main Toggle Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={toggleMusic}
            variant="outline"
            size="icon"
            className={`
              h-12 w-12 rounded-full border-2 transition-all duration-300 shadow-lg
              ${isPlaying 
                ? 'bg-slate-900 border-cyan-500 text-cyan-400 shadow-cyan-500/20 hover:bg-cyan-500/10 hover:shadow-cyan-500/40' 
                : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500'
              }
            `}
          >
            {isPlaying ? (
              <Music className="h-5 w-5 animate-pulse-glow" />
            ) : (
              <VolumeX className="h-5 w-5" />
            )}
            <span className="sr-only">Toggle Music</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-slate-900 border-cyan-500 text-cyan-400">
          <p>{isPlaying ? 'Music On' : 'Music Off'}</p>
          <p className="text-xs text-slate-500 capitalize mt-1">Now Playing: {currentPhase}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

export default MusicPlayerWidget;
