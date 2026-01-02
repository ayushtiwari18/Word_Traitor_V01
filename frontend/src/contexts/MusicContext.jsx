import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const MusicContext = createContext();

export const useMusic = () => useContext(MusicContext);

export const MusicProvider = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [currentPhase, setCurrentPhase] = useState('lobby'); // 'lobby' | 'game' | 'results'
  
  const audioRef = useRef(null);
  const fadeInterval = useRef(null);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const savedMusicEnabled = localStorage.getItem('music_enabled');
    const savedVolume = localStorage.getItem('music_volume');

    if (savedMusicEnabled !== null) {
      setIsPlaying(savedMusicEnabled === 'true');
    }
    if (savedVolume !== null) {
      setVolume(parseFloat(savedVolume));
    }
  }, []);

  // Handle Audio Logic
  useEffect(() => {
    // Cleanup previous audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Determine track based on phase
    let trackPath = '';
    switch (currentPhase) {
      case 'lobby':
        trackPath = '/music/lobby.mp3';
        break;
      case 'game':
        trackPath = '/music/game.mp3';
        break;
      case 'results':
        trackPath = '/music/results.mp3';
        break;
      default:
        trackPath = '/music/lobby.mp3';
    }

    if (trackPath) {
      const audio = new Audio(trackPath);
      audio.loop = true;
      audio.volume = isPlaying ? volume : 0;
      audioRef.current = audio;

      if (isPlaying) {
        // Attempt to play (browser might block auto-play)
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn("Autoplay prevented by browser. Interaction needed.", error);
            setIsPlaying(false); // Reset state so user has to click play
          });
        }
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [currentPhase]);

  // Handle Play/Pause Toggle
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.volume = volume;
        audioRef.current.play().catch(e => console.warn("Play failed", e));
      } else {
        audioRef.current.pause();
      }
    }
    localStorage.setItem('music_enabled', isPlaying);
  }, [isPlaying]);

  // Handle Volume Change
  useEffect(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.volume = volume;
    }
    localStorage.setItem('music_volume', volume);
  }, [volume]);

  const toggleMusic = () => setIsPlaying(prev => !prev);

  return (
    <MusicContext.Provider value={{ 
      isPlaying, 
      toggleMusic, 
      volume, 
      setVolume, 
      currentPhase, 
      setPhase: setCurrentPhase 
    }}>
      {children}
    </MusicContext.Provider>
  );
};
