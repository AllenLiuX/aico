// PlaylistSection.js
import React from 'react';
import { Plus } from 'lucide-react';
import PlaylistTrack from '../PlaylistTrack';

const PlaylistSection = ({
  playlist,
  isHost,
  currentTrack,
  roomName,
  onTrackClick,
  onTrackDelete,
  onPinToTop,
  stopProgressTracking,
  onAddMusicClick
}) => {
  return (
    <div className="playlist-section">
      <div className="playlist-header">
        <h3>Playlist ({playlist.length} songs)</h3>
        <button onClick={onAddMusicClick} className="control-button add-music-button">
          <Plus size={20} />
          Add Music
        </button>
      </div>
      <ul className="track-list">
        {playlist.length > 0 ? (
          playlist.map((track, index) => (
            <PlaylistTrack
              key={`${track.song_id}-${index}`}
              track={track}
              index={index}
              isHost={isHost}
              isCurrentTrack={index === currentTrack}
              currentPlayingIndex={currentTrack}
              roomName={roomName}
              onTrackClick={onTrackClick}
              onTrackDelete={onTrackDelete}
              onPinToTop={onPinToTop}
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