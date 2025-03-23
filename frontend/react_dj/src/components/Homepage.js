// Homepage.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Music, Users, Zap, Heart, Headphones, Sparkles, ArrowRight } from 'lucide-react';
import '../styles/Homepage.css';
import { formatRoomName } from '../utils/formatRoomName';

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

  // Generate random positions for music notes
  const generateMusicNotes = () => {
    const notes = ['♪', '♫', '♬', '♩'];
    const musicNotes = [];
    
    for (let i = 0; i < 15; i++) {
      const note = notes[Math.floor(Math.random() * notes.length)];
      const left = `${Math.random() * 100}%`;
      const animationDuration = `${15 + Math.random() * 30}s`;
      const animationDelay = `${Math.random() * 10}s`;
      const size = `${Math.random() * 20 + 16}px`;
      
      musicNotes.push(
        <div 
          key={i} 
          className="music-note" 
          style={{ 
            left, 
            animationDuration, 
            animationDelay,
            fontSize: size
          }}
        >
          {note}
        </div>
      );
    }
    
    return musicNotes;
  };

  const handleCreateRoom = () => {
    // Generate a default room name if not provided
    const defaultRoomName = roomName || `Room-${Math.floor(Math.random() * 10000)}`;
    
    // Navigate directly to playlist generator with room parameters
    navigate(`/playlist?room_name=${encodeURIComponent(defaultRoomName)}&moderation=${moderation}`);
  };

  const handleFavoritesRoom = () => {
    if (isLoggedIn && username) {
      // Navigate to the user's favorites room
      const favoritesRoomName = `favorites_${username}`;
      navigate(`/playroom?room_name=${favoritesRoomName}&is_host=True`);
    } else {
      // If not logged in, redirect to login page
      navigate('/');
    }
  };

  const handleGetStarted = () => {
    if (isLoggedIn) {
      navigate('/playlist');
    } else {
      navigate('/login');
    }
  };

  // Generate audio wave bars
  const generateAudioWaveBars = () => {
    const bars = [];
    for (let i = 0; i < 40; i++) {
      bars.push(<div key={i} className="audio-bar" style={{ height: `${Math.random() * 30 + 10}px` }}></div>);
    }
    return bars;
  };

  return (
    <div className="homepage">
      {/* Animated background elements */}
      <div className="music-notes">
        {generateMusicNotes()}
      </div>
      
      <div className="audio-wave">
        {generateAudioWaveBars()}
      </div>

      <section className="hero-section">
        <h1 className="hero-title">AICO's Music Room</h1>
        <p className="hero-subtitle">
          Experience the future of music with our AI-powered platform. Create and share intelligent playlists, 
          collaborate with friends in real-time, and discover new music tailored to your unique taste.
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
        <h2 className="features-heading">Intelligent Music Experience</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-container">
              <Sparkles className="feature-icon" />
            </div>
            <h3 className="feature-title">AI-Powered Playlists</h3>
            <p className="feature-description">
              Our advanced AI algorithms create the perfect playlist based on your preferences, mood, and listening habits.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon-container">
              <Users className="feature-icon" />
            </div>
            <h3 className="feature-title">Collaborative Rooms</h3>
            <p className="feature-description">
              Create or join virtual music rooms and enjoy synchronized music experiences with friends in real-time.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon-container">
              <Headphones className="feature-icon" />
            </div>
            <h3 className="feature-title">Smart Recommendations</h3>
            <p className="feature-description">
              Discover new music that perfectly matches your taste with our intelligent recommendation system.
            </p>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <h2 className="cta-title">Ready to Transform Your Music Experience?</h2>
        <p className="cta-text">
          Join thousands of music lovers who are already enjoying the future of music with AICO.
        </p>
        <button onClick={handleGetStarted} className="cta-button">
          Get Started Now
          <ArrowRight size={20} />
        </button>
      </section>
    </div>
  );
}

export default Homepage;