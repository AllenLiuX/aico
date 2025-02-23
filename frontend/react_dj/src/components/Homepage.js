// Homepage.js
import React from 'react';
import { Link } from 'react-router-dom';
import { Music, Users, Zap } from 'lucide-react';
import '../styles/Homepage.css';

function Homepage() {
  return (
    <div className="homepage">
      <section className="hero-section">
        <h1 className="hero-title">AICO's Room</h1>
        <p className="hero-subtitle">
          Create and share AI-powered music playlists with friends in real-time
        </p>
        <div className="button-container">
          <Link to="/create_room" className="hero-button create-button">
            <Zap size={20} />
            Create Room
          </Link>
          <Link to="/join_room" className="hero-button join-button">
            <Users size={20} />
            Join Room
          </Link>
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