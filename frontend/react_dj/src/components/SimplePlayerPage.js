import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './SimplePlayerPage.css';

const SimplePlayerPage = () => {
  // State variables
  const [playlist, setPlaylist] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // References
  const audioRef = useRef(null);
  const progressIntervalRef = useRef(null);
  
  // Router hooks
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get roomName from URL query parameters
  const queryParams = new URLSearchParams(location.search);
  const roomName = queryParams.get('room_name');

  // Fetch playlist when component mounts or room name changes
  useEffect(() => {
    const fetchPlaylist = async () => {
      if (!roomName) {
        setError("No room name provided. Please specify a room_name in the URL.");
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const response = await fetch(`http://13.56.253.58:5000/api/room-playlist?room_name=${roomName}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch playlist (${response.status})`);
        }
        
        const data = await response.json();
        console.log("Playlist data:", data);
        
        if (data.playlist && Array.isArray(data.playlist)) {
          setPlaylist(data.playlist);
          setLoading(false);
        } else {
          setError("Invalid playlist data received from server");
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching playlist:", err);
        setError(`Failed to load playlist: ${err.message}`);
        setLoading(false);
      }
    };

    fetchPlaylist();
  }, [roomName]);

  // Setup audio player and cleanup on unmount
  useEffect(() => {
    const audio = audioRef.current;
    
    const handleEnded = () => {
      playNext();
    };
    
    if (audio) {
      audio.addEventListener('ended', handleEnded);
    }
    
    return () => {
      if (audio) {
        audio.removeEventListener('ended', handleEnded);
      }
      
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [currentTrack, playlist]);

  // Update audio source when current track changes
  useEffect(() => {
    if (playlist.length > 0 && currentTrack < playlist.length) {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = playlist[currentTrack].url;
        if (isPlaying) {
          audio.play().catch(err => {
            console.error("Error playing track:", err);
            setError(`Cannot play this track: ${err.message}`);
          });
        }
      }
    }
  }, [currentTrack, playlist, isPlaying]);

  // Progress tracking effect
  useEffect(() => {
    if (isPlaying) {
      progressIntervalRef.current = setInterval(() => {
        const audio = audioRef.current;
        if (audio) {
          setProgress((audio.currentTime / audio.duration) * 100 || 0);
        }
      }, 1000);
    } else if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying]);

  // Player controls
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(err => {
        console.error("Error playing track:", err);
        setError(`Cannot play this track: ${err.message}`);
      });
    }
    
    setIsPlaying(!isPlaying);
  };

  const playNext = () => {
    if (playlist.length === 0) return;
    setCurrentTrack((prev) => (prev + 1) % playlist.length);
  };

  const playPrevious = () => {
    if (playlist.length === 0) return;
    setCurrentTrack((prev) => (prev - 1 + playlist.length) % playlist.length);
  };

  const handleProgressChange = (e) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newProgress = parseFloat(e.target.value);
    setProgress(newProgress);
    audio.currentTime = (newProgress / 100) * audio.duration;
  };

  // Format time (seconds to MM:SS)
  const formatTime = (timeInSeconds) => {
    if (!timeInSeconds) return "0:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Handle back navigation
  const handleBack = () => {
    navigate('/homepage');
  };

  // Render loading state
  if (loading) {
    return (
      <div className="simple-player-page loading">
        <div className="loader"></div>
        <p>Loading playlist...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="simple-player-page error">
        <h2>Something went wrong</h2>
        <p>{error}</p>
        <button onClick={handleBack} className="back-button">Go Back</button>
      </div>
    );
  }

  // Render empty playlist state
  if (playlist.length === 0) {
    return (
      <div className="simple-player-page empty">
        <h2>No songs in playlist</h2>
        <p>This room doesn't have any songs yet.</p>
        <button onClick={handleBack} className="back-button">Go Back</button>
      </div>
    );
  }

  // Get current track info
  const currentSong = playlist[currentTrack];

  return (
    <div className="simple-player-page">
      <div className="header">
        <button onClick={handleBack} className="back-button">←</button>
        <h1>Room: {roomName}</h1>
      </div>
      
      <div className="player-container">
        <div className="album-art">
          {currentSong.image_url ? (
            <img src={currentSong.image_url} alt={`${currentSong.title} cover`} />
          ) : (
            <div className="placeholder-art">
              <span>♪</span>
            </div>
          )}
        </div>
        
        <div className="song-info">
          <h2>{currentSong.title}</h2>
          <p>{currentSong.artist}</p>
        </div>
        
        <div className="progress-container">
          <span className="time-elapsed">
            {formatTime(audioRef.current?.currentTime || 0)}
          </span>
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={handleProgressChange}
            className="progress-bar"
          />
          <span className="time-total">
            {formatTime(audioRef.current?.duration || 0)}
          </span>
        </div>
        
        <div className="controls">
          <button onClick={playPrevious} className="control-button previous">
            ⏮
          </button>
          <button onClick={togglePlay} className="control-button play-pause">
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button onClick={playNext} className="control-button next">
            ⏭
          </button>
        </div>
      </div>
      
      <div className="playlist-section">
        <h3>Playlist ({playlist.length} songs)</h3>
        <ul className="track-list">
          {playlist.map((track, index) => (
            <li 
              key={index}
              className={index === currentTrack ? 'active' : ''}
              onClick={() => setCurrentTrack(index)}
            >
              <span className="track-number">{index + 1}</span>
              <div className="track-details">
                <span className="track-title">{track.title}</span>
                <span className="track-artist">{track.artist}</span>
              </div>
              {index === currentTrack && (
                <span className="now-playing">▶</span>
              )}
            </li>
          ))}
        </ul>
      </div>
      
      {/* Hidden audio element */}
      <audio ref={audioRef} />
    </div>
  );
};

export default SimplePlayerPage;