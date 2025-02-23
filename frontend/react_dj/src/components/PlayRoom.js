// PlayRoom.js
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PlaylistTrack from './PlaylistTrack';

import { 
  Play, Pause, SkipBack, SkipForward, Share2, 
  QrCode, Plus, Music 
} from 'lucide-react';
import '../styles/PlayRoom.css';

function PlayRoom() {
  // State variables
  const [playlist, setPlaylist] = useState([]);
  const [introduction, setIntroduction] = useState('');
  const [settings, setSettings] = useState({});
  const [showTooltip, setShowTooltip] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hostData, setHostData] = useState(null);

  const progressIntervalRef = useRef(null);
  const playerRef = useRef(null);
  const playerContainerRef = useRef(null);
  
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const roomName = queryParams.get('room_name');
  const isHost = queryParams.get('is_host') === 'True';

  useEffect(() => {
    if (!roomName) {
      navigate('/homepage');
      return;
    }

    const fetchRoomData = async () => {
      try {
        setLoading(true);
        // const response = await fetch(`http://127.0.0.1:5000/api/room-playlist?room_name=${roomName}`);
        const response = await fetch(`http://13.56.253.58:5000/api/room-playlist?room_name=${roomName}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch playlist (${response.status})`);
        }
        
        const data = await response.json();
        setPlaylist(data.playlist || []);
        setIntroduction(data.introduction || '');
        setSettings(data.settings || {});
        setHostData(data.host || null);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching room data:', error);
        setError(`Failed to load playlist: ${error.message}`);
        setLoading(false);
      }
    };

    fetchRoomData();
  }, [roomName, navigate]);

  useEffect(() => {
    if (playlist.length === 0 || loading || error) return;
  
    // Initialize player if not already initialized
    if (document.getElementById('youtube-iframe-api')) {
      initPlayer();
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
  }, [playlist, loading, error, currentTrack]);

  const onPlayerError = (event) => {
    console.error("YouTube player error:", event.data);
    const errorMessages = {
      2: "Invalid video ID",
      5: "HTML5 player error",
      100: "Video not found or removed",
      101: "Video cannot be played in embedded players",
      150: "Video cannot be played in embedded players"
    };
    setError(`Player error: ${errorMessages[event.data] || `Unknown error (code: ${event.data})`}`);
  };

  const initPlayer = () => {
    if (!playlist.length || !window.YT || !playerContainerRef.current) return;

    try {
      if (playerRef.current) {
        playerRef.current.destroy();
      }

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
    } catch (err) {
      console.error("Error initializing YouTube player:", err);
      setError(`Failed to initialize player: ${err.message}`);
    }
  };

  const extractVideoId = (url) => {
    if (!url) return '';
    const match = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/);
    return match ? match[1] : '';
  };

  const onPlayerReady = (event) => {
    if (isPlaying) {
      event.target.playVideo();
    }
  };

  const onPlayerStateChange = (event) => {
    const playerState = event.data;
    
    if (playerState === 0) {
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
      setError("Invalid video URL");
      return;
    }
    
    // Load and play the video
    playerRef.current.loadVideoById(videoId);
    setIsPlaying(true);
  };

  // const loadVideo = (index) => {
  //   if (!playerRef.current || !playlist[index]) return;
    
  //   const videoId = extractVideoId(playlist[index].song_url);
  //   if (!videoId) {
  //     setError("Invalid video URL");
  //     return;
  //   }
    
  //   playerRef.current.loadVideoById(videoId);
  //   setIsPlaying(true);
  // };

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

  const copyShareLink = () => {
    const shareLink = `http://aico-music.com/playroom?room_name=${roomName}`;
    navigator.clipboard.writeText(shareLink).then(() => {
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 2000);
    });
  };

  const handleQRCodeClick = () => {
    setShowQRCode(true);
  };

  const handleSearchMusic = () => {
    navigate(`/search_music?room=${roomName}`);
  };

  const playSpecificTrack = (index) => {
    console.log(`Playing specific track at index ${index}:`, playlist[index].title);
    setCurrentTrack(index);
    loadVideo(index);
  };

  const handleTrackDelete = (newPlaylist) => {
    // Cleanup player state
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  
    // If there are songs remaining in the playlist
    if (newPlaylist.length > 0) {
      // If deleting current track, move to next song or previous if at end
      if (currentTrack >= newPlaylist.length) {
        setCurrentTrack(newPlaylist.length - 1);
      }
      // Load the new track
      const nextVideoId = extractVideoId(newPlaylist[currentTrack].song_url);
      if (playerRef.current && nextVideoId) {
        playerRef.current.loadVideoById(nextVideoId);
      }
    } else {
      // If no songs left, reset player
      setCurrentTrack(0);
      setIsPlaying(false);
      if (playerRef.current) {
        playerRef.current.stopVideo();
      }
    }
  
    // Update playlist
    setPlaylist(newPlaylist);
  };

  if (loading) {
    return (
      <div className="play-room loading">
        <div className="loader"></div>
        <p>Loading playlist...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="play-room error">
        <h2>Something went wrong</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/homepage')} className="back-button">
          Go Back
        </button>
      </div>
    );
  }

  const currentSong = playlist[currentTrack] || {};

  return (
    <div className="play-room">
      <div className="room-header">
        <div className="room-info">
          <h1>{roomName}</h1>
          <div className="host-info">
            {hostData ? (
              <>
                <img 
                  src={hostData.avatar} 
                  alt={`${hostData.username}'s avatar`}
                  className="host-avatar"
                />
                <span>Created by {hostData.username}</span>
              </>
            ) : (
              <span>Public Room</span>
            )}
          </div>
        </div>
        <div className="room-controls">
          <button onClick={handleQRCodeClick} className="control-button">
            <QrCode size={20} />
          </button>
          <button onClick={copyShareLink} className="share-button">
            <Share2 size={20} />
            Share Room
          </button>
          {showTooltip && <div className="tooltip">Link copied!</div>}
        </div>
      </div>
      
      <div className="player-grid">
        <div className="player-container">
          <div className="album-art">
            {currentSong.cover_img_url ? (
              <img 
                src={currentSong.cover_img_url} 
                alt={`${currentSong.title} cover`} 
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/api/placeholder/300/300';
                }}
              />
            ) : (
              <div className="placeholder-art">
                <Music size={48} />
              </div>
            )}
          </div>
          
          <div className="song-info">
            <h2>{currentSong.title || 'No track selected'}</h2>
            <p>{currentSong.artist || 'Unknown artist'}</p>
          </div>
          
          <div className="progress-container">
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={handleProgressChange}
              className="progress-bar"
            />
            <div className="time-display">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          
          <div className="player-controls">
            <button onClick={playPrevious} className="control-button">
              <SkipBack size={24} />
            </button>
            <button onClick={togglePlay} className="control-button play-button">
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>
            <button onClick={playNext} className="control-button">
              <SkipForward size={24} />
            </button>
          </div>

          <div ref={playerContainerRef} id="youtube-player"></div>
        </div>

        <div className="playlist-section">
          <div className="playlist-header">
            <h3>Playlist ({playlist.length} songs)</h3>
            <button onClick={handleSearchMusic} className="control-button add-music-button">
              <Plus size={20} />
              Add Music
            </button>
          </div>
          <ul className="track-list">
            {playlist.map((track, index) => (
              <PlaylistTrack
                key={index}
                track={track}
                index={index}
                isHost={isHost}
                isCurrentTrack={index === currentTrack}
                roomName={roomName}
                onTrackClick={playSpecificTrack}
                onTrackDelete={handleTrackDelete}
                stopProgressTracking={stopProgressTracking}
              />
            ))}
          </ul>
        </div>
      </div>

      <div className="playlist-info-section">
        <h2>About this Playlist</h2>
        <p className="playlist-description">{introduction || 'No description available'}</p>
        {settings && Object.keys(settings).length > 0 && (
          <div className="playlist-settings">
            {settings.prompt && (
              <div className="setting-item">
                <span className="setting-label">Prompt:</span>
                <span>{settings.prompt}</span>
              </div>
            )}
            {settings.genre && (
              <div className="setting-item">
                <span className="setting-label">Genre:</span>
                <span>{settings.genre}</span>
              </div>
            )}
            {settings.occasion && (
              <div className="setting-item">
                <span className="setting-label">Occasion:</span>
                <span>{settings.occasion}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {showQRCode && (
        <div className="qr-code-overlay">
          <div className="qr-code-modal">
            <img 
              src={`/images/qr_code_${roomName}.png`} 
              alt="Room QR Code" 
            />
            <div className="qr-code-buttons">
              <button onClick={() => setShowQRCode(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlayRoom;