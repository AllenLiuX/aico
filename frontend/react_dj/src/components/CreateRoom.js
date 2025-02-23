import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Music, Settings } from 'lucide-react';

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
      <form onSubmit={handleSubmit} className="room-form">
        <h1>Create Room</h1>
        
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