// PlaylistInfoSection.js
import React from 'react';

const PlaylistInfoSection = ({ introduction, settings }) => {
  return (
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
  );
};

export default PlaylistInfoSection;