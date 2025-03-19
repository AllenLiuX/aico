// Homepage.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Music, Users, Zap, Heart } from 'lucide-react';
import '../styles/Homepage.css';

function Homepage() {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState('');
  const [moderation, setModeration] = useState('no');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');

  // Check if user is logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userDataStr = localStorage.getItem('user');
    
    if (token && userDataStr) {
      try {
        const userData = JSON.parse(userDataStr);
        setIsLoggedIn(true);
        setUsername(userData.username || '');
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }
  }, []);

  const handleCreateRoom = () => {
    // Generate a default room name if not provided
    const defaultRoomName = roomName || `Room-${Math.floor(Math.random() * 10000)}`;
    
    // Navigate directly to playlist generator with room parameters
    navigate(`/playlist?room_name=${encodeURIComponent(defaultRoomName)}&moderation=${moderation}`);
  };

  const handleFavoritesRoom = () => {
    if (isLoggedIn && username) {
      // Navigate to the user's favorites room
      navigate(`/playroom?room_name=favorites_${username}&is_host=True`);
    } else {
      // If not logged in, redirect to login page
      navigate('/');
    }
  };

  return (
    <div className="homepage">
      <section className="hero-section">
        <h1 className="hero-title">AICO's Room</h1>
        <p className="hero-subtitle">
          Create and share AI-powered music playlists with friends in real-time
        </p>
        <div className="button-container">
          <button onClick={handleCreateRoom} className="hero-button create-button">
            <Zap size={20} />
            Create Room
          </button>
          <Link to="/join_room" className="hero-button join-button">
            <Users size={20} />
            Join Room
          </Link>
          {isLoggedIn && (
            <button onClick={handleFavoritesRoom} className="hero-button favorites-button">
              <Heart size={20} />
              My Favorites
            </button>
          )}
        </div>
      </section>

      <section className="features-section">
        <div className="features-grid">
          <div className="feature-card">
            <Music className="feature-icon" />
            <h3 className="feature-title">AI-Powered Playlists</h3>
            <p className="feature-description">
              Let our AI create the perfect playlist based on your preferences and mood
            </p>
          </div>
          <div className="feature-card">
            <Users className="feature-icon" />
            <h3 className="feature-title">Collaborative Rooms</h3>
            <p className="feature-description">
              Join rooms with friends and enjoy music together in real-time
            </p>
          </div>
          <div className="feature-card">
            <Zap className="feature-icon" />
            <h3 className="feature-title">Smart Recommendations</h3>
            <p className="feature-description">
              Get personalized music suggestions based on your listening habits
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Homepage;