// frontend/react_dj/src/hooks/useYouTubePlayer.js - Direct Player Control

import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

/**
 * Custom hook to manage YouTube player functionality
 * with real-time synchronization between host and guests
 */
const useYouTubePlayer = (playlist, socket, isHost, emitPlayerState) => {
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playerError, setPlayerError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [syncedWithHost, setSyncedWithHost] = useState(true); // Track if guest is synced with host
  
  const progressIntervalRef = useRef(null);
  const playerRef = useRef(null);
  const playerContainerRef = useRef(null);
  const playerIframeRef = useRef(null);
  const lastStateUpdate = useRef(null);
  const pendingSync = useRef(null);
  const playerReadyRef = useRef(false);
  const currentVideoIdRef = useRef(null);
  const lastHostState = useRef(null); // Store the last state update from host
  
  // Don't update player state too frequently to avoid excessive network traffic
  const SYNC_THROTTLE_MS = 1000;

  // Initialize YouTube player when playlist is available
  useEffect(() => {
    if (playlist.length === 0) return;
    
    // Clear any previous errors
    setPlayerError(null);
    
    // Function to initialize the player
    const setupPlayer = () => {
      // Check if YT API is loaded
      if (window.YT && window.YT.Player) {
        console.log("YouTube API is loaded, initializing player");
        initPlayer();
      } else {
        console.log("YouTube API not yet loaded, waiting...");
        // Wait for API to load
        const checkYT = setInterval(() => {
          if (window.YT && window.YT.Player) {
            console.log("YouTube API loaded after waiting");
            clearInterval(checkYT);
            initPlayer();
          }
        }, 500);
        
        // Set a timeout to prevent infinite waiting
        setTimeout(() => {
          clearInterval(checkYT);
          if (!window.YT || !window.YT.Player) {
            console.error("YouTube API failed to load after timeout");
            setPlayerError("Failed to load YouTube player. Please refresh the page.");
          }
        }, 10000);
      }
    };
  
    // Check if the API script is already loaded
    if (document.getElementById('youtube-iframe-api')) {
      setupPlayer();
      return;
    }
  
    // Load the YouTube API script
    const tag = document.createElement('script');
    tag.id = 'youtube-iframe-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    
    // Add error handling for script loading
    tag.onerror = () => {
      console.error("Failed to load YouTube iframe API script");
      setPlayerError("Failed to load YouTube player. Please check your internet connection and try again.");
    };
    
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  
    // Set up the callback for when the API is ready
    window.onYouTubeIframeAPIReady = () => {
      console.log("YouTube iframe API ready");
      setupPlayer();
    };
  
    return () => {
      window.onYouTubeIframeAPIReady = null;
    };
  }, [playlist]);

  // Initialize a function to store a reference to the iframe
  const capturePlayerIframe = useCallback(() => {
    if (!playerIframeRef.current) {
      // Get the iframe created by the YouTube Player API
      const iframe = document.querySelector('#youtube-player iframe');
      if (iframe) {
        console.log('Captured player iframe reference');
        playerIframeRef.current = iframe;
      }
    }
  }, []);

  // Listen for player state updates from socket
  useEffect(() => {
    if (!socket) return;
    
    // Handle player state updates from the host
    const handlePlayerStateUpdate = (playerState) => {
      if (isHost) return; // Host doesn't need to react to its own updates
      
      console.log('Received player state update:', playerState);
      
      // Store the last host state for sync functionality
      lastHostState.current = playerState;
      
      // If synced with host, apply the state update
      if (syncedWithHost) {
        // Store sync information for application
        pendingSync.current = playerState;
        
        // Check if it's a track change
        if (playerState.currentTrack !== undefined && 
            playerState.currentTrack !== currentTrack) {
          
          // Update state immediately to update UI
          setCurrentTrack(playerState.currentTrack);
          
          // Get the track info
          const trackToPlay = playlist[playerState.currentTrack];
          if (!trackToPlay) {
            console.error('Track not found in playlist:', playerState.currentTrack);
            return;
          }
          
          const videoId = extractVideoId(trackToPlay.song_url);
          if (!videoId) {
            console.error('Could not extract video ID from URL:', trackToPlay.song_url);
            return;
          }
          
          // Force direct iframe control for track change
          forcePlayVideo(videoId, playerState.currentTime || 0, playerState.isPlaying !== false);
        } else {
          // For play/pause and seek operations, use the normal sync
          if (!lastStateUpdate.current) {
            applyStateSync(playerState);
          }
        }
      }
    };
    
    // Add event listener
    socket.on('player_state_update', handlePlayerStateUpdate);
    
    // Cleanup
    return () => {
      socket.off('player_state_update', handlePlayerStateUpdate);
    };
  }, [socket, isHost, currentTrack, playlist, syncedWithHost]);

  // Extremely direct method to force video playback by manipulating the iframe directly
  const forcePlayVideo = (videoId, startSeconds = 0, autoplay = true) => {
    // Capture the iframe if we haven't already
    capturePlayerIframe();
    
    console.log(`DIRECT CONTROL: Loading video ${videoId} at ${startSeconds}s with autoplay=${autoplay}`);
    
    // Update our reference to the current video
    currentVideoIdRef.current = videoId;
    
    // Update state to show correct info in UI
    setIsPlaying(autoplay);
    
    // Method 1: Try using the player API if it's available
    if (playerRef.current && playerReadyRef.current) {
      try {
        if (autoplay) {
          console.log('Using player API: loadVideoById');
          playerRef.current.loadVideoById({
            videoId: videoId,
            startSeconds: startSeconds
          });
          return; // If this worked, we're done
        } else {
          console.log('Using player API: cueVideoById');
          playerRef.current.cueVideoById({
            videoId: videoId,
            startSeconds: startSeconds
          });
          return; // If this worked, we're done
        }
      } catch (e) {
        console.error('Player API method failed:', e);
        // Continue to fallback methods
      }
    }
    
    // Method 2: Direct iframe URL manipulation - most reliable but least elegant
    try {
      if (playerIframeRef.current) {
        const iframe = playerIframeRef.current;
        
        // Build the YouTube embed URL with appropriate parameters
        const params = new URLSearchParams();
        params.append('autoplay', autoplay ? '1' : '0');
        params.append('start', Math.floor(startSeconds));
        params.append('enablejsapi', '1');
        params.append('fs', '0');
        params.append('modestbranding', '1');
        params.append('rel', '0');
        params.append('origin', window.location.origin);
        params.append('playsinline', '1');
        params.append('protocol', 'https'); // Force HTTPS protocol for the player
        params.append('controls', '0');
        params.append('disablekb', '1');
        
        const embedUrl = `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
        console.log('Setting iframe src to:', embedUrl);
        
        // Set the src attribute to force load the new video
        iframe.src = embedUrl;
        
        // Monitor for actual change in what's playing
        const checkInterval = setInterval(() => {
          if (playerRef.current && playerReadyRef.current) {
            try {
              const currentId = playerRef.current.getVideoData().video_id;
              console.log(`Current playing video: ${currentId}, target: ${videoId}`);
              
              if (currentId === videoId) {
                // Video changed successfully
                clearInterval(checkInterval);
                
                // Ensure correct playback state
                if (autoplay && playerRef.current.getPlayerState() !== 1) {
                  playerRef.current.playVideo();
                } else if (!autoplay && playerRef.current.getPlayerState() === 1) {
                  playerRef.current.pauseVideo();
                }
                
                // Seek to correct position if needed
                const currentTime = playerRef.current.getCurrentTime() || 0;
                if (Math.abs(currentTime - startSeconds) > 2) {
                  playerRef.current.seekTo(startSeconds, true);
                }
              }
            } catch (e) {
              console.error('Error checking video ID:', e);
            }
          }
        }, 500);
        
        // Stop checking after 10 seconds
        setTimeout(() => clearInterval(checkInterval), 10000);
      } else {
        console.error('No iframe reference available for direct control');
      }
    } catch (e) {
      console.error('Direct iframe control failed:', e);
      setPlayerError('Failed to control video playback. Please refresh the page.');
    }
  };

  // Emit player state changes to guests (host only)
  useEffect(() => {
    if (!isHost || !emitPlayerState || !isInitialized) return;
    
    // Throttled function to emit player state
    const emitState = () => {
      const now = Date.now();
      if (lastStateUpdate.current && now - lastStateUpdate.current < SYNC_THROTTLE_MS) {
        return;
      }
      
      if (playerRef.current && playerReadyRef.current) {
        try {
          // Get the most current player data
          const currentPlayerTime = playerRef.current.getCurrentTime() || 0;
          const playerDuration = playerRef.current.getDuration() || 0;
          const currentPlayerState = playerRef.current.getPlayerState();
          const isPlayerPlaying = currentPlayerState === 1; // YT.PlayerState.PLAYING = 1
          
          // If we have a videoId reference, include it for verification
          let videoData = {};
          try {
            videoData = playerRef.current.getVideoData();
          } catch (e) {
            console.warn('Could not get video data:', e);
          }
          
          const playerState = {
            currentTrack,
            isPlaying: isPlayerPlaying,
            progress: (currentPlayerTime / playerDuration) * 100 || 0,
            currentTime: currentPlayerTime,
            duration: playerDuration,
            videoId: videoData.video_id,
            timestamp: now
          };
          
          console.log("Host sending player state:", playerState);
          emitPlayerState(playerState);
          lastStateUpdate.current = now;
        } catch (err) {
          console.error('Error emitting player state:', err);
        }
      }
    };
    
    // Create an interval to emit state periodically for better sync
    const syncInterval = setInterval(() => {
      if (isPlaying) {
        emitState();
      }
    }, 5000); // Send sync update every 5 seconds while playing
    
    // Emit state immediately when play state changes
    if (isPlaying !== undefined) {
      emitState();
    }
    
    // Emit state when current track changes
    if (currentTrack !== undefined) {
      emitState();
    }
    
    // Clean up interval on unmount
    return () => {
      clearInterval(syncInterval);
    };
    
  }, [isHost, emitPlayerState, isPlaying, currentTrack, isInitialized]);

  // Apply player state sync received from host
  const applyStateSync = (playerState) => {
    if (!playerRef.current || isHost || !playerReadyRef.current) return;
    
    lastStateUpdate.current = Date.now();
    
    try {
      // Sync time position if it's far enough from current position (over 2 seconds)
      if (playerState.currentTime !== undefined) {
        const currentPlayerTime = playerRef.current.getCurrentTime() || 0;
        const timeDiff = Math.abs(currentPlayerTime - playerState.currentTime);
        
        if (timeDiff > 2) {
          // When seeking, we'll handle play state after seeking completes
          playerRef.current.seekTo(playerState.currentTime, true);
          
          // After seeking, ensure play state matches
          setTimeout(() => {
            syncPlayState(playerState.isPlaying);
          }, 300);
        } else {
          // Time is close enough, just sync play state
          syncPlayState(playerState.isPlaying);
        }
      } else {
        // No time info, just sync play state
        syncPlayState(playerState.isPlaying);
      }
      
      // Clear the sync lock after a short delay
      setTimeout(() => {
        lastStateUpdate.current = null;
        
        // Apply any pending sync
        if (pendingSync.current) {
          const nextSync = pendingSync.current;
          pendingSync.current = null;
          applyStateSync(nextSync);
        }
      }, 500);
      
    } catch (err) {
      console.error('Error applying player state sync:', err);
      lastStateUpdate.current = null;
    }
  };
  
  // Helper to sync play state safely
  const syncPlayState = (shouldPlay) => {
    if (!playerRef.current || !playerReadyRef.current) return;
    
    try {
      const currentState = playerRef.current.getPlayerState();
      const isCurrentlyPlaying = currentState === 1; // YT.PlayerState.PLAYING = 1
      
      if (shouldPlay && !isCurrentlyPlaying) {
        console.log("Starting playback");
        playerRef.current.playVideo();
      } else if (!shouldPlay && isCurrentlyPlaying) {
        console.log("Pausing playback");
        playerRef.current.pauseVideo();
      }
      
      // Update local state
      setIsPlaying(shouldPlay);
    } catch (error) {
      console.error("Error syncing play state:", error);
    }
  };

  // Function to sync with host's current state (for guests)
  const syncWithHost = () => {
    if (isHost || !lastHostState.current) return;
    
    console.log('Syncing with host state:', lastHostState.current);
    setSyncedWithHost(true);
    
    const hostState = lastHostState.current;
    
    // Update track if different
    if (hostState.currentTrack !== undefined && 
        hostState.currentTrack !== currentTrack) {
      
      setCurrentTrack(hostState.currentTrack);
      
      // Get the track info
      const trackToPlay = playlist[hostState.currentTrack];
      if (!trackToPlay) {
        console.error('Track not found in playlist:', hostState.currentTrack);
        return;
      }
      
      const videoId = extractVideoId(trackToPlay.song_url);
      if (!videoId) {
        console.error('Could not extract video ID from URL:', trackToPlay.song_url);
        return;
      }
      
      // Force direct iframe control for track change
      forcePlayVideo(videoId, hostState.currentTime || 0, hostState.isPlaying !== false);
    } else {
      // Just sync time and play state
      if (playerRef.current && playerReadyRef.current) {
        // Sync time
        if (hostState.currentTime !== undefined) {
          playerRef.current.seekTo(hostState.currentTime, true);
        }
        
        // Sync play state
        if (hostState.isPlaying) {
          playerRef.current.playVideo();
        } else {
          playerRef.current.pauseVideo();
        }
        
        setIsPlaying(hostState.isPlaying);
      }
    }
  };

  const extractVideoId = (url) => {
    if (!url) return '';
    
    // Ensure URL is using HTTPS
    let secureUrl = url;
    if (url.startsWith('http:')) {
      secureUrl = url.replace('http:', 'https:');
      console.log('Converted YouTube URL to HTTPS:', secureUrl);
    }
    
    const match = secureUrl.match(/[?&]v=([^&]+)/) || secureUrl.match(/youtu\.be\/([^?]+)/);
    return match ? match[1] : '';
  };

  // Function to try alternative video sources
  const tryAlternativeSource = (trackIndex) => {
    if (!playlist[trackIndex]) return false;
    
    const track = playlist[trackIndex];
    
    // Check if the track has an alternative URL
    if (track.alternative_url) {
      console.log(`Trying alternative URL for track: ${track.title}`);
      
      const videoId = extractVideoId(track.alternative_url);
      if (videoId) {
        // Load the alternative video
        if (playerRef.current) {
          playerRef.current.loadVideoById(videoId);
          return true;
        }
      }
    }
    
    return false;
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
    
    // Handle embedding disabled errors (101, 150)
    if (event.data === 101 || event.data === 150) {
      setPlayerError(`This video cannot be embedded due to YouTube restrictions. Try a different video.`);
      
      // First try an alternative source if available
      if (tryAlternativeSource(currentTrack)) {
        console.log("Trying alternative source for current track");
        return;
      }
      
      // If we're the host, automatically try to play the next track
      if (isHost && playlist.length > 1) {
        console.log("Embedding disabled for current video. Attempting to play next track...");
        setTimeout(() => {
          playNext();
        }, 3000);
      }
    } else {
      setPlayerError(`Player error: ${errorMessages[event.data] || `Unknown error (code: ${event.data})`}`);
    }
  };

  const initPlayer = () => {
    if (!playlist.length) {
      console.log("Cannot initialize player: playlist is empty");
      return;
    }
    
    if (!window.YT || !window.YT.Player) {
      console.error("Cannot initialize player: YouTube API not loaded");
      setPlayerError("YouTube player failed to load. Please refresh the page.");
      return;
    }
    
    if (!playerContainerRef.current) {
      console.error("Cannot initialize player: player container not found");
      setPlayerError("Player container not found. Please refresh the page.");
      return;
    }
  
    try {
      // Only create player if it doesn't exist
      if (!playerRef.current) {
        console.log("Creating new YouTube player instance");
        const videoId = extractVideoId(playlist[currentTrack].song_url);
        
        if (!videoId) {
          console.error("Invalid video URL:", playlist[currentTrack].song_url);
          setPlayerError("Invalid YouTube URL. Please check the video link.");
          return;
        }
        
        console.log("Initializing player with video ID:", videoId);
        
        playerRef.current = new window.YT.Player(playerContainerRef.current, {
          height: '0',
          width: '0',
          videoId: videoId,
          playerVars: {
            autoplay: isHost ? 1 : 0, // Only autoplay for host
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            origin: window.location.origin,
            playsinline: 1,
            protocol: 'https' // Force HTTPS protocol for the player
          },
          events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
            onError: onPlayerError
          }
        });
        
        // Store the video ID reference
        currentVideoIdRef.current = videoId;
      } else {
        console.log("Player already initialized");
      }
    } catch (err) {
      console.error("Error initializing YouTube player:", err);
      setPlayerError(`Failed to initialize player: ${err.message}`);
    }
  };

  const onPlayerReady = (event) => {
    console.log("YouTube player ready");
    playerReadyRef.current = true;
    setIsInitialized(true);
    
    // Clear any previous errors
    setPlayerError(null);
    
    // Capture the iframe reference right after player is ready
    capturePlayerIframe();
    
    // Get video duration
    try {
      const newDuration = event.target.getDuration();
      if (newDuration && newDuration > 0) {
        setDuration(newDuration);
        console.log(`Video duration: ${newDuration} seconds`);
      } else {
        console.warn("Could not get video duration from player");
      }
    } catch (err) {
      console.error("Error getting video duration:", err);
    }
    
    // Start playing if host
    if (isHost) {
      try {
        event.target.playVideo();
        console.log("Auto-playing video for host");
      } catch (err) {
        console.error("Error auto-playing video:", err);
      }
    }
    
    // Start tracking progress
    startProgressTracking();
  };

  const onPlayerStateChange = (event) => {
    const playerState = event.data;
    
    if (playerState === 0) { // Video ended
      if (isHost) {
        // Only host can automatically advance to the next track
        setCurrentTrack(prevTrack => {
          const nextIndex = (prevTrack + 1) % playlist.length;
          setTimeout(() => {
            if (playerRef.current && playlist[nextIndex]) {
              const videoId = extractVideoId(playlist[nextIndex].song_url);
              if (videoId) {
                loadVideo(nextIndex);
              }
            }
          }, 50);
          return nextIndex;
        });
      }
    }
    
    const isNowPlaying = playerState === 1;
    setIsPlaying(isNowPlaying);
    
    if (isNowPlaying) {
      startProgressTracking();
      
      // Log song play when the player state changes to playing
      if (isHost) {
        logSongPlay(currentTrack);
      }
    } else {
      stopProgressTracking();
    }
  };

  const startProgressTracking = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    progressIntervalRef.current = setInterval(() => {
      if (playerRef.current && playerReadyRef.current) {
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

  // Modified togglePlay to handle guest playback
  const togglePlay = () => {
    if (!playerRef.current || !playerReadyRef.current) return;
    
    try {
      // If guest is synced with host, unsync when they manually control playback
      if (!isHost && syncedWithHost) {
        setSyncedWithHost(false);
      }
      
      const currentState = playerRef.current.getPlayerState();
      if (currentState === 1) { // Playing
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
        // Log song play when resuming
        logSongPlay(currentTrack);
      }
    } catch (error) {
      console.error("Error toggling play state:", error);
    }
  };

  const playNext = () => {
    if (playlist.length === 0) return;

    const nextIndex = (currentTrack + 1) % playlist.length;
    setCurrentTrack(nextIndex);

    if (isHost) {
      // Host: use normal load which will propagate state to guests
      loadVideo(nextIndex);
    } else {
      // Guest: break sync and play locally
      if (syncedWithHost) setSyncedWithHost(false);
      const nextTrack = playlist[nextIndex];
      if (!nextTrack) return;
      const videoId = extractVideoId(nextTrack.song_url);
      if (videoId) {
        forcePlayVideo(videoId, 0, true);
      }
    }
  };

  const playPrevious = () => {
    if (playlist.length === 0) return;

    const prevIndex = (currentTrack - 1 + playlist.length) % playlist.length;
    setCurrentTrack(prevIndex);

    if (isHost) {
      loadVideo(prevIndex);
    } else {
      if (syncedWithHost) setSyncedWithHost(false);
      const prevTrack = playlist[prevIndex];
      if (!prevTrack) return;
      const videoId = extractVideoId(prevTrack.song_url);
      if (videoId) {
        forcePlayVideo(videoId, 0, true);
      }
    }
  };

  const loadVideo = (index) => {
    // Only allow host to load videos directly
    if (!isHost || !playerRef.current || !playlist[index] || !playerReadyRef.current) return;
    
    // Update currentTrack first
    setCurrentTrack(index);
    
    const videoId = extractVideoId(playlist[index].song_url);
    if (!videoId) {
      setPlayerError("Invalid video URL");
      return;
    }
    
    // For host, we can just use the standard loading method
    try {
      playerRef.current.loadVideoById({
        videoId: videoId,
        startSeconds: 0
      });
    } catch (e) {
      console.error("Host loadVideoById failed:", e);
      
      // Fallback to direct control
      forcePlayVideo(videoId, 0, true);
    }
    
    // Update state
    setIsPlaying(true);
    currentVideoIdRef.current = videoId;
    
    // Log song play when loading a new video
    logSongPlay(index);
  };

  const formatTime = (timeInSeconds) => {
    if (!timeInSeconds || isNaN(timeInSeconds)) return "0:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleProgressChange = (e) => {
    if (!playerRef.current || !playerReadyRef.current) return;

    const newProgress = parseFloat(e.target.value);
    setProgress(newProgress);

    const seekTime = (newProgress / 100) * duration;

    // Guests break sync when they manually seek
    if (!isHost && syncedWithHost) setSyncedWithHost(false);

    try {
      playerRef.current.seekTo(seekTime, true);
    } catch (err) {
      console.error('Error seeking video:', err);
    }
  };

  const playSpecificTrack = (index) => {
    if (!playlist[index]) return;

    console.log(`Playing specific track at index ${index}:`, playlist[index]?.title);
    setCurrentTrack(index);

    if (isHost) {
      // Host: broadcast via normal loadVideo
      loadVideo(index);
    } else {
      // Guest: break sync and play locally
      if (syncedWithHost) setSyncedWithHost(false);
      const videoId = extractVideoId(playlist[index].song_url);
      if (videoId) {
        forcePlayVideo(videoId, 0, true);
      }
    }
  };

  const handlePinToTop = (selectedIndex, currentPlayingIndex) => {
    // Only allow host to pin tracks
    if (!isHost || selectedIndex === currentPlayingIndex || !playlist.length) return;
    
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

  // Function to log song play to backend
  const logSongPlay = useCallback((trackIndex) => {
    if (!playlist || !playlist[trackIndex]) return;
    
    const track = playlist[trackIndex];
    const roomName = localStorage.getItem('currentRoom');
    const token = localStorage.getItem('token');
    
    if (!token || !roomName) return;
    
    console.log('Logging song play:', track.title);
    
    axios.post(`${API_URL}/api/songs/log-play`, {
      song_id: track.song_id,
      title: track.title,
      artist: track.artist,
      room_name: roomName
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      console.log('Song play logged successfully:', response.data);
    })
    .catch(error => {
      console.error('Error logging song play:', error);
    });
  }, [playlist]);

  // Return values and functions
  return {
    currentTrack,
    isPlaying,
    progress,
    duration,
    currentTime,
    playerContainerRef,
    togglePlay,
    playNext,
    playPrevious,
    formatTime,
    handleProgressChange,
    playSpecificTrack,
    handlePinToTop,
    stopProgressTracking,
    isHost,
    playerError,
    syncWithHost, // New function to sync with host
    syncedWithHost  // New state to track sync status
  };
};

export default useYouTubePlayer;