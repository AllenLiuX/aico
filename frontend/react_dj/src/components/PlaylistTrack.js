import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import '../styles/PlaylistTrack.css';
const PlaylistTrack = ({ 
  track = {},
  index = 0,
  isHost = false,
  isCurrentTrack = false,
  roomName = '',
  onTrackClick = () => {},
  onTrackDelete = () => {},
  stopProgressTracking = () => {}
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = async (e) => {
    e.stopPropagation();
    
    if (!isHost || isDeleting || !track.song_id) return;
    
    try {
      setIsDeleting(true);
      setError(null);
      
      stopProgressTracking();

      // const response = await fetch('http://127.0.0.1:5000/api/remove-from-playlist', {
      const response = await fetch('http://13.56.253.58:5000/api/remove-from-playlist', {

        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room_name: roomName,
          track_id: track.song_id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete track');
      }

      const data = await response.json();
      onTrackDelete(data.playlist);
      
    } catch (err) {
      setError('Failed to delete track');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <li 
      className={`${isCurrentTrack ? 'track-item active' : 'track-item'}`}
      onClick={() => onTrackClick(index)}
    >
      {track.cover_img_url && (
        <img 
          src={track.cover_img_url} 
          alt=""
          className="track-thumbnail"
          onError={(e) => {
            e.target.onerror = null;
            e.target.style.display = 'none';
          }}
        />
      )}
      <span className="track-number">{index + 1}</span>
      <div className="track-details">
        <span className="track-title">{track.title}</span>
        <span className="track-artist">{track.artist}</span>
        {error && <span className="text-red-500 text-xs">{error}</span>}
      </div>
      {isCurrentTrack && !isHost && (
        <span className="now-playing">▶</span>
      )}
      
      {isHost && (
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="delete-button"
          title="Delete track"
        >
          <Trash2 className="trash-icon" />
        </button>
      )}
    </li>
  );
};

export default PlaylistTrack;