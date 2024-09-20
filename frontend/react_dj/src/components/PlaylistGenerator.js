// components/PlaylistGenerator.js
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PreferenceForm from './PreferenceForm';
import Playlist from './Playlist';
import ShareButton from './ShareButton';

function PlaylistGenerator() {
  const [playlist, setPlaylist] = useState(null);
  const [roomName, setRoomName] = useState('');
  const [moderation, setModeration] = useState('no');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setRoomName(params.get('room_name') || '');
    setModeration(params.get('moderation') || 'no');
  }, [location]);

  const generatePlaylist = async (preferences) => {
    try {
      // const response = await fetch('http://127.0.0.1:5000/api/generate-playlist', {  # local
      const response = await fetch('http://13.56.253.58:5000/api/generate-playlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...preferences, room_name: roomName }),
      });
      const data = await response.json();
      setPlaylist(data.playlist);
    } catch (error) {
      console.error('Error generating playlist:', error);
    }
  };

  const createRoom = () => {
    navigate(`/playroom?room_name=${encodeURIComponent(roomName)}&moderation=${moderation}&is_host=True`);
  };

  return (
    <div className="playlist-generator">
      <header>
        <h1>ALCO Room: {roomName || 'Unnamed Room'}</h1>
        {/* <ShareButton /> */}
      </header>
      <PreferenceForm onSubmit={generatePlaylist} />
      {playlist && <Playlist tracks={playlist} />}
      {playlist && <button onClick={createRoom} className="big-button">Create Room</button>}
    </div>
  );
}

export default PlaylistGenerator;

// // components/PlaylistGenerator.js
// import React, { useState } from 'react';
// import { useLocation, useNavigate } from 'react-router-dom';
// import PreferenceForm from './PreferenceForm';
// import Playlist from './Playlist';
// import ShareButton from './ShareButton';

// function PlaylistGenerator() {
//   const [playlist, setPlaylist] = useState(null);
//   const location = useLocation();
//   const navigate = useNavigate();
//   const roomSettings = location.state;

//   const generatePlaylist = async (preferences) => {
//     try {
//       const response = await fetch('http://127.0.0.1:4999/api/generate-playlist', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ ...preferences, ...roomSettings }),
//       });
//       const data = await response.json();
//       setPlaylist(data.playlist);
//     } catch (error) {
//       console.error('Error generating playlist:', error);
//     }
//   };

//   const createRoom = () => {
//     navigate(`/playroom?room_name=${roomSettings.roomName}&is_host=True`);
//   };

//   return (
//     <div className="playlist-generator">
//       <header>
//         <h1>AICO Room: {roomSettings?.roomName || 'Unnamed Room'}</h1>
//         <ShareButton />
//       </header>
//       <PreferenceForm onSubmit={generatePlaylist} />
//       {playlist && <Playlist tracks={playlist} />}
//       {playlist && <button onClick={createRoom} className="big-button">Create Room</button>}
//     </div>
//   );
// }

// export default PlaylistGenerator;
