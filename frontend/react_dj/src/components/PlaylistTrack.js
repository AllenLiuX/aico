import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import './PlaylistTrack.css';

const PlaylistTrack = ({ 
  track = {},
  index = 0,
  isHost = false,
  isCurrentTrack = false,
  roomName = '',
  onTrackClick = () => {},
  onTrackDelete = () => {},
  stopProgressTracking = () => {}  // Add this prop
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  const {
    id = '',
    cover_img_url = '',
    title = 'Untitled',
    artist = 'Unknown Artist'
  } = track;

  const handleDelete = async (e) => {
    e.stopPropagation();
    
    if (!isHost || isDeleting || !id) return;
    
    try {
      setIsDeleting(true);
      setError(null);
      
      // Stop progress tracking before making any changes to playlist
      stopProgressTracking();

      const response = await fetch('http://127.0.0.1:5000/api/remove-from-playlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room_name: roomName,
          track_id: id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete track');
      }

      const data = await response.json();
      onTrackDelete(data.playlist);
    } catch (err) {
      setError('Failed to delete track. Please try again.');
      console.error('Error deleting track:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <li 
      className={`${isCurrentTrack ? 'active' : ''}`}
      onClick={() => onTrackClick(index)}
    >
      {cover_img_url && (
        <img 
          src={cover_img_url} 
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
        <span className="track-title">{title}</span>
        <span className="track-artist">{artist}</span>
        {error && <span className="text-red-500 text-xs">{error}</span>}
      </div>
      {isCurrentTrack && !isHost &&(
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