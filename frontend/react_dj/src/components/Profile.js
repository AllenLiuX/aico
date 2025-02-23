// Profile.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Music, Plus, Users } from 'lucide-react';
import '../styles/Profile.css';

const RoomCard = ({ room }) => {
  const navigate = useNavigate();

  const handleRoomClick = () => {
    navigate(`/playroom?room_name=${room.name}&is_host=True`);
  };

  return (
    <div className="room-card" onClick={handleRoomClick}>
      <div className="room-card-image">
        <img
          src={room.cover_image || '/api/placeholder/300/200'}
          alt={room.name}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/api/placeholder/300/200';
          }}
        />
        <div className="room-card-overlay">
          <div className="room-song-count">
            <Music size={14} />
            <span>{room.song_count} songs</span>
          </div>
        </div>
      </div>
      <div className="room-card-content">
        <h3>{room.name}</h3>
        <p>{room.introduction || 'No description'}</p>
        <div className="room-card-tags">
          {room.genre && (
            <span className="tag genre-tag">{room.genre}</span>
          )}
          {room.occasion && (
            <span className="tag occasion-tag">{room.occasion}</span>
          )}
        </div>
      </div>
    </div>
  );
};

function Profile() {
  const [user, setUser] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserRooms = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setLoading(false);
          return;
        }

        const response = await fetch('http://13.56.253.58:5000/api/user/rooms', {
          headers: {
            'Authorization': token
          }
        });

        if (!response.ok) throw new Error('Failed to fetch rooms');
        
        const data = await response.json();
        setRooms(data.rooms);
      } catch (err) {
        setError('Failed to load rooms');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
      fetchUserRooms();
    } else {
      setLoading(false);
    }
  }, []);

  const handleCreateRoom = () => {
    navigate('/create_room');
  };

  if (loading) {
    return (
      <div className="profile-container">
        <div className="loading">Loading your profile...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="profile-container">
        <div className="auth-message">Please login to view your profile.</div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div className="user-info">
          <img
            src={user.avatar}
            alt="Profile"
            className="user-avatar"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/api/placeholder/64/64';
            }}
          />
          <div className="user-details">
            <h1>{user.username}</h1>
            <p>{user.email}</p>
          </div>
        </div>
      </div>

      <div className="rooms-container">
        <div className="rooms-header">
          <h2>
            <Users size={20} />
            Your Rooms
            <span className="room-count">({rooms.length})</span>
          </h2>
          <button className="create-room-button" onClick={handleCreateRoom}>
            <Plus size={20} />
            Create New Room
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="rooms-grid">
          {rooms.map((room) => (
            <RoomCard key={room.name} room={room} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default Profile;