// frontend/react_dj/src/components/playroom-components/PlayerControls.js
import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Music, FileText, Volume2 } from 'lucide-react';

const PlayerControls = ({
  currentSong,
  isPlaying,
  progress,
  duration,
  currentTime,
  formatTime,
  handleProgressChange,
  togglePlay,
  playNext,
  playPrevious,
  showLyrics,
  onToggleLyrics,
  isHost // New prop to determine if user is host
}) => {
  return (
    <div className="player-controls-container">
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
          className={`progress-bar ${!isHost ? 'guest-progress' : ''}`}
          disabled={!isHost} // Disable scrubbing for guests
        />
        <div className="time-display">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      
      <div className="player-controls">
        {isHost ? (
          // Host controls with full functionality
          <>
            <button onClick={playPrevious} className="control-button">
              <SkipBack size={24} />
            </button>
            <button onClick={togglePlay} className="control-button play-button">
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>
            <button onClick={playNext} className="control-button">
              <SkipForward size={24} />
            </button>
          </>
        ) : (
          // Guest view with volume indicator instead of controls
          <div className="guest-controls">
            <Volume2 size={24} className="volume-icon" />
            <span className="sync-status">
              {isPlaying ? 'Playing' : 'Paused'}
            </span>
          </div>
        )}
        
        <button 
          onClick={onToggleLyrics} 
          className={`control-button lyrics-button ${showLyrics ? 'active' : ''}`}
          title={showLyrics ? "Hide lyrics" : "Show lyrics"}
        >
          <FileText size={20} />
        </button>
      </div>
      
      {!isHost && (
        <div className="guest-message">
          <div className="sync-indicator"></div>
          Your playback is synced with the host
        </div>
      )}
    </div>
  );
};

export default PlayerControls;