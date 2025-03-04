// useYouTubePlayer.js
import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to manage YouTube player functionality
 */
const useYouTubePlayer = (playlist) => {
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playerError, setPlayerError] = useState(null);
  
  const progressIntervalRef = useRef(null);
  const playerRef = useRef(null);
  const playerContainerRef = useRef(null);

  // Initialize YouTube player when playlist is available
  useEffect(() => {
    if (playlist.length === 0) return;
  
    // Initialize player if not already initialized
    if (document.getElementById('youtube-iframe-api')) {
      // Only initialize if player doesn't exist yet
      if (!playerRef.current) {
        initPlayer();
      }
      return;
    }
  
    const tag = document.createElement('script');
    tag.id = 'youtube-iframe-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  
    window.onYouTubeIframeAPIReady = initPlayer;
  
    return () => {
      window.onYouTubeIframeAPIReady = null;
    };
  }, [playlist]);

  const extractVideoId = (url) => {
    if (!url) return '';
    const match = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/);
    return match ? match[1] : '';
  };

  const onPlayerError = (event) => {
    console.error("YouTube player error:", event.data);
    const errorMessages = {
      2: "Invalid video ID",
      5: "HTML5 player error",
      100: "Video not found or removed",
      101: "Video cannot be played in embedded players",
      150: "Video cannot be played in embedded players"
    };
    setPlayerError(`Player error: ${errorMessages[event.data] || `Unknown error (code: ${event.data})`}`);
  };

  const initPlayer = () => {
    if (!playlist.length || !window.YT || !playerContainerRef.current) return;
  
    try {
      // Only create player if it doesn't exist
      if (!playerRef.current) {
        const videoId = extractVideoId(playlist[currentTrack].song_url);
        playerRef.current = new window.YT.Player(playerContainerRef.current, {
          height: '0',
          width: '0',
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            origin: window.location.origin,
            playsinline: 1
          },
          events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
            onError: onPlayerError
          }
        });
      }
    } catch (err) {
      console.error("Error initializing YouTube player:", err);
      setPlayerError(`Failed to initialize player: ${err.message}`);
    }
  };

  const onPlayerReady = (event) => {
    if (isPlaying) {
      event.target.playVideo();
    }
  };

  const onPlayerStateChange = (event) => {
    const playerState = event.data;
    
    if (playerState === 0) { // Video ended
      setCurrentTrack(prevTrack => {
        const nextIndex = (prevTrack + 1) % playlist.length;
        setTimeout(() => {
          if (playerRef.current) {
            const videoId = extractVideoId(playlist[nextIndex].song_url);
            if (videoId) {
              playerRef.current.loadVideoById(videoId);
            }
          }
        }, 50);
        return nextIndex;
      });
    }
    
    const isNowPlaying = playerState === 1;
    setIsPlaying(isNowPlaying);
    
    if (isNowPlaying) {
      startProgressTracking();
    } else {
      stopProgressTracking();
    }
  };

  const startProgressTracking = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    progressIntervalRef.current = setInterval(() => {
      if (playerRef.current) {
        const currentTime = playerRef.current.getCurrentTime() || 0;
        const totalDuration = playerRef.current.getDuration() || 0;
        const progressPercent = (currentTime / totalDuration) * 100 || 0;
        
        setProgress(progressPercent);
        setCurrentTime(currentTime);
        setDuration(totalDuration);
      }
    }, 1000);
  };

  const stopProgressTracking = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const togglePlay = () => {
    if (!playerRef.current) return;
    
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const playNext = () => {
    if (playlist.length === 0) return;
    const nextIndex = (currentTrack + 1) % playlist.length;
    setCurrentTrack(nextIndex);
    loadVideo(nextIndex);
  };

  const playPrevious = () => {
    if (playlist.length === 0) return;
    const prevIndex = (currentTrack - 1 + playlist.length) % playlist.length;
    setCurrentTrack(prevIndex);
    loadVideo(prevIndex);
  };

  const loadVideo = (index) => {
    if (!playerRef.current || !playlist[index]) return;
    
    // Update currentTrack first
    setCurrentTrack(index);
    
    const videoId = extractVideoId(playlist[index].song_url);
    if (!videoId) {
      setPlayerError("Invalid video URL");
      return;
    }
    
    // Load and play the video
    playerRef.current.loadVideoById(videoId);
    setIsPlaying(true);
  };

  const formatTime = (timeInSeconds) => {
    if (!timeInSeconds || isNaN(timeInSeconds)) return "0:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleProgressChange = (e) => {
    if (!playerRef.current) return;
    
    const newProgress = parseFloat(e.target.value);
    setProgress(newProgress);
    
    const seekTime = (newProgress / 100) * duration;
    playerRef.current.seekTo(seekTime, true);
  };

  const playSpecificTrack = (index) => {
    console.log(`Playing specific track at index ${index}:`, playlist[index]?.title);
    setCurrentTrack(index);
    loadVideo(index);
  };

  const handlePinToTop = (selectedIndex, currentPlayingIndex) => {
    if (selectedIndex === currentPlayingIndex || !playlist.length) return;
    
    // Create a copy of the playlist
    const updatedPlaylist = [...playlist];
    
    // Get the track to be pinned
    const trackToPin = updatedPlaylist[selectedIndex];
    
    // Remove the track from its current position
    updatedPlaylist.splice(selectedIndex, 1);
    
    // Determine the target position
    let targetPosition;
    
    if (isPlaying || playerRef.current) {
      // If a song is playing, insert after the current track
      targetPosition = currentTrack + 1;
    } else {
      // If no song is playing, insert at the current selectedTrack position
      targetPosition = currentTrack;
    }
    
    // Insert the track at the target position
    updatedPlaylist.splice(targetPosition, 0, trackToPin);
    
    // Return the updated playlist
    return updatedPlaylist;
  };

  return {
    currentTrack,
    setCurrentTrack,
    isPlaying,
    progress,
    duration,
    currentTime,
    playerError,
    playerContainerRef,
    playerRef,
    togglePlay,
    playNext,
    playPrevious,
    loadVideo,
    formatTime,
    handleProgressChange,
    playSpecificTrack,
    handlePinToTop,
    stopProgressTracking
  };
};

export default useYouTubePlayer;