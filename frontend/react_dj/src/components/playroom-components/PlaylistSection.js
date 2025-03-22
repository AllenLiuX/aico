// Fixed PlaylistSection.js to properly handle track selection
import React from 'react';
import { Plus, Sparkles } from 'lucide-react';
import PlaylistTrack from '../PlaylistTrack';

const PlaylistSection = ({
  playlist,
  fullPlaylistLength, // Added for pagination
  isHost,
  currentTrack,
  roomName,
  onTrackClick,
  onTrackDelete,
  onPinToTop,
  stopProgressTracking,
  onAddMusicClick,
  onGeneratePlaylistClick
}) => {
  return (
    <div className="playlist-section">
      <div className="playlist-header">
        <h3>Playlist ({fullPlaylistLength || playlist.length} songs)</h3>
        <div className="playlist-actions">
          {isHost && (
            <button onClick={onGeneratePlaylistClick} className="control-button generate-playlist-button">
              <Sparkles size={18} />
              Generate Playlist
            </button>
          )}
          <button 
            onClick={onAddMusicClick} 
            className={`control-button add-music-button ${!isHost ? 'guest-add-music-button' : ''}`}
          >
            <Plus size={!isHost ? 20 : 18} />
            {!isHost ? 'Add Song' : 'Add Music'}
          </button>
        </div>
      </div>
      
      {/* Guest Add Song Button - Visible only for non-hosts and only on mobile */}
      {!isHost && (
        <div className="guest-add-song-container">
          <button 
            onClick={onAddMusicClick} 
            className="guest-add-song-button-mobile"
          >
            <Plus size={24} />
            Add Song
          </button>
        </div>
      )}
      
      <ul className="track-list">
        {playlist.length > 0 ? (
          playlist.map((track, index) => (
            <PlaylistTrack
              key={`${track.song_id}-${index}`}
              track={track}
              index={index}
              pageIndex={index} // Keep the original page index for display
              isHost={isHost}
              isCurrentTrack={track.song_id === playlist[currentTrack]?.song_id}
              currentPlayingIndex={currentTrack}
              roomName={roomName}
              onTrackClick={() => onTrackClick(index)}
              onTrackDelete={onTrackDelete}
              onPinToTop={onPinToTop} // Keep passing the same function, we'll adjust the index in PlayRoom.js
              stopProgressTracking={stopProgressTracking}
            />
          ))
        ) : (
          <li className="no-tracks-message">No tracks in playlist</li>
        )}
      </ul>
    </div>
  );
};

export default PlaylistSection;