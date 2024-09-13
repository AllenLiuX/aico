// components/JoinRoom.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function JoinRoom() {
  const [roomNumber, setRoomNumber] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate(`/playroom?room_name=${roomNumber}&is_host=False`);
    // Here you would typically validate the room number with your backend
    console.log({ roomNumber });
    // For now, we'll just navigate to the main app page
    // navigate('/app');
    // navigate('/playlist', { state: { roomNumber } });
  };

  return (
    <div className="join-room">
      <h1>Join Room</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="roomNumber">Room Number:</label>
          <input
            type="text"
            id="roomNumber"
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="big-button">Join</button>
      </form>
    </div>
  );
}

export default JoinRoom;