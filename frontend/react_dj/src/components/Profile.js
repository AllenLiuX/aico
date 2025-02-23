// Profile.js
import React, { useState, useEffect } from 'react';
import { Heart, Music, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../styles/Profile.css';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('created');
  const navigate = useNavigate();
  
  // Mock data for testing
  const mockRooms = {
    created: [
      {
        id: 1,
        name: "Summer Vibes",
        coverImage: "/api/placeholder/300/200",
        description: "Perfect playlist for summer days",
        songCount: 15
      },
      {
        id: 2,
        name: "Workout Mix",
        coverImage: "/api/placeholder/300/200",
        description: "High energy songs to keep you motivated",
        songCount: 20
      }
    ],
    favorited: [
      {
        id: 3,
        name: "Chill Evening",
        coverImage: "/api/placeholder/300/200",
        description: "Relaxing tunes for the evening",
        songCount: 12
      },
      {
        id: 4,
        name: "Party Mix",
        coverImage: "/api/placeholder/300/200",
        description: "Ultimate party playlist",
        songCount: 25
      }
    ]
  };

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleCreateRoom = () => {
    navigate('/create_room');
  };

  if (!user) {
    return (
      <div className="profile-container">
        <div className="text-center">Please login to view your profile.</div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <img
          src={user.avatar}
          alt="Profile"
          className="profile-avatar"
        />
        <div className="profile-info">
          <h1>{user.name}</h1>
          <p>{user.email}</p>
        </div>
      </div>

      <div className="profile-tabs">
        <button
          className={`tab-button ${activeTab === 'created' ? 'active' : ''}`}
          onClick={() => setActiveTab('created')}
        >
          <Music size={20} className="mr-2" />
          Created Rooms
        </button>
        <button
          className={`tab-button ${activeTab === 'favorited' ? 'active' : ''}`}
          onClick={() => setActiveTab('favorited')}
        >
          <Heart size={20} className="mr-2" />
          Favorited Rooms
        </button>
      </div>

      <div className="room-grid">
        {activeTab === 'created' && (
          <div className="create-room-card" onClick={handleCreateRoom}>
            <Plus size={40} className="text-purple-500 mb-2" />
            <p>Create New Room</p>
          </div>
        )}
        
        {mockRooms[activeTab].map((room) => (
          <div key={room.id} className="room-card">
            <img
              src={room.coverImage}
              alt={room.name}
              className="room-image"
            />
            <div className="room-content">
              <h3 className="room-title">{room.name}</h3>
              <p className="room-description">{room.description}</p>
              <div className="room-footer">
                <span className="song-count">
                  {room.songCount} songs
                </span>
                {activeTab === 'favorited' && (
                  <button className="favorite-button">
                    <Heart size={20} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Profile;