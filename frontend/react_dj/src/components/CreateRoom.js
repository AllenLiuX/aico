import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Music, Settings, MusicIcon, Headphones, Radio } from 'lucide-react';

function CreateRoom() {
  const [roomName, setRoomName] = useState('');
  const [password, setPassword] = useState('');
  const [moderation, setModeration] = useState('no');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  // Create animated music notes
  useEffect(() => {
    const container = document.querySelector('.room-form-notes');
    if (!container) return;

    const noteSymbols = ['♪', '♫', '♬', '♩', '♭', '♮'];
    const createNote = () => {
      const note = document.createElement('div');
      note.className = 'room-form-note';
      note.textContent = noteSymbols[Math.floor(Math.random() * noteSymbols.length)];
      note.style.left = `${Math.random() * 100}%`;
      note.style.animationDuration = `${15 + Math.random() * 10}s`;
      note.style.animationDelay = `${Math.random() * 5}s`;
      container.appendChild(note);

      // Remove note after animation completes
      setTimeout(() => {
        if (note && note.parentNode === container) {
          container.removeChild(note);
        }
      }, 25000); // slightly longer than max animation time
    };

    // Create initial batch of notes
    for (let i = 0; i < 10; i++) {
      createNote();
    }

    // Create new notes periodically
    const interval = setInterval(createNote, 3000);

    return () => {
      clearInterval(interval);
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Get authentication token if user is logged in
    const token = localStorage.getItem('token');
    
    // Navigate to playlist generation with auth state
    navigate(`/playlist?room_name=${encodeURIComponent(roomName)}&moderation=${moderation}`, {
      state: { authToken: token }
    });
  };

  return (
    <div className="room-form-container">
      {/* Animated background elements */}
      <div className="room-form-notes"></div>
      
      <form onSubmit={handleSubmit} className="room-form">
        <h1>Create Your Room</h1>
        
        {!isAuthenticated && (
          <div className="auth-warning">
            <p>Note: Login to save this room to your profile</p>
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="roomName" className="form-label">
            <Music size={18} className="icon" />
            Room Name
          </label>
          <input
            type="text"
            id="roomName"
            className="form-input"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Enter a unique room name"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password" className="form-label">
            <Lock size={18} className="icon" />
            Password (Optional)
          </label>
          <input
            type="password"
            id="password"
            className="form-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Set a password for private rooms"
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            <Settings size={18} className="icon" />
            Moderation
          </label>
          <div className="toggle-label">
            <span>Enable moderation</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                className="toggle-input"
                checked={moderation === 'yes'}
                onChange={(e) => setModeration(e.target.checked ? 'yes' : 'no')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        <button type="submit" className="submit-button">
          Create Room
        </button>
      </form>
    </div>
  );
}

export default CreateRoom;