// PlayerControls.js
import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Music } from 'lucide-react';

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
  playPrevious
}) => {
  return (
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
    </div>
  );
};

export default PlayerControls;