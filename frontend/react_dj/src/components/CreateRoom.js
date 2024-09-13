// components/CreateRoom.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function CreateRoom() {
  const [roomName, setRoomName] = useState('');
  const [password, setPassword] = useState('');
  const [moderation, setModeration] = useState('no');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    // Here you would typically send this data to your backend
    const roomSettings = { roomName, password, moderation };
    console.log({ roomName, password, moderation });
    // For now, we'll just navigate to the main app page
    // navigate('/app');
    navigate('/playlist', { state: roomSettings });
  };

  return (
    <div className="create-room">
      <h1>Create Room</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="roomName">Room Name:</label>
          <input
            type="text"
            id="roomName"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="moderation">Moderation:</label>
          <select
            id="moderation"
            value={moderation}
            onChange={(e) => setModeration(e.target.value)}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        <button type="submit" className="big-button">Create</button>
      </form>
    </div>
  );
}

export default CreateRoom;