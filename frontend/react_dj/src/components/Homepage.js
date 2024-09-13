// components/Homepage.js
import React from 'react';
import { Link } from 'react-router-dom';

function Homepage() {
  return (
    <div className="homepage">
      <h1>AICO's Room</h1>
      <div className="button-container">
        <Link to="/create_room" className="big-button">Create Room</Link>
        <Link to="/join_room" className="big-button">Join Room</Link>
      </div>
    </div>
  );
}

export default Homepage;