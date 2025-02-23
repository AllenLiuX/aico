// JoinRoom.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import '../styles/RoomForms.css';

function JoinRoom() {
  const [roomNumber, setRoomNumber] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate(`/playroom?room_name=${roomNumber}&is_host=False`);
  };

  return (
    <div className="room-form-container">
      <form onSubmit={handleSubmit} className="room-form">
        <h1>Join Room</h1>
        
        <div className="form-group">
          <label htmlFor="roomNumber" className="form-label">
            <Users size={18} className="icon" />
            Room Number
          </label>
          <input
            type="text"
            id="roomNumber"
            className="form-input"
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            required
            placeholder="Enter room number"
          />
        </div>

        <button type="submit" className="submit-button">
          Join Room
        </button>
      </form>
    </div>
  );
}

export default JoinRoom;