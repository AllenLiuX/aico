// components/PlayRoom.js
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function PlayRoom() {
  const [playlist, setPlaylist] = useState([]);
  const [showTooltip, setShowTooltip] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const roomName = queryParams.get('room_name');
  const isHost = queryParams.get('is_host') === 'True';

  useEffect(() => {
    if (!roomName) {
      navigate('/homepage');
      return;
    }

    const fetchPlaylist = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:4999/api/room-playlist?room_name=${roomName}`);
        const data = await response.json();
        setPlaylist(data.playlist);
      } catch (error) {
        console.error('Error fetching playlist:', error);
      }
    };

    fetchPlaylist();
  }, [roomName, navigate]);

  const copyShareLink = () => {
    const shareLink = `${window.location.origin}/playroom?room_name=${roomName}`;
    navigator.clipboard.writeText(shareLink).then(() => {
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 2000);
    });
  };

  return (
    <div className="play-room">
      <header>
        <div className="room-info">
          <h1>Room: {roomName}</h1>
          <p>You are {isHost ? 'the host' : 'a guest'}</p>
        </div>
        <div className="share-button-container">
          <button onClick={copyShareLink} className="share-button">
            Share Room and Invite Friends ⚡️
          </button>
          {showTooltip && <div className="tooltip">Link copied!</div>}
        </div>
      </header>
      
      <main className="playlist-container">
        <h2>The Playlist</h2>
        <ul className="playlist">
          {playlist.map((track, index) => (
            <li key={index} className="playlist-item">
              <span className="track-info">{track.title} - {track.artist}</span>
              <a 
                href={track.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="spotify-link"
              >
                Listen on Spotify
              </a>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

export default PlayRoom;


// // components/PlayRoom.js
// import React, { useState, useEffect } from 'react';
// import { useLocation, useNavigate } from 'react-router-dom';
// // import ShareButton from './ShareButton';

// function PlayRoom() {
//   const [playlist, setPlaylist] = useState([]);
//   const location = useLocation();
//   const navigate = useNavigate();
//   const queryParams = new URLSearchParams(location.search);
//   const roomName = queryParams.get('room_name');
//   const isHost = queryParams.get('is_host') === 'True';

//   useEffect(() => {
//     if (!roomName) {
//       navigate('/homepage');
//       return;
//     }

//     const fetchPlaylist = async () => {
//       try {
//         const response = await fetch(`http://127.0.0.1:4999/api/room-playlist?room_name=${roomName}`);
//         const data = await response.json();
//         setPlaylist(data.playlist);
//       } catch (error) {
//         console.error('Error fetching playlist:', error);
//       }
//     };

//     fetchPlaylist();
//   }, [roomName, navigate]);

//   return (
//     <div className="play-room">
//       <header>
//         <h1>Room: {roomName}</h1>
//         <p>You are {isHost ? 'the host' : 'a guest'}</p>
//       </header>
//       <ShareButton />
//       <main className="playlist-container">
//         <h2>The Playlist</h2>
//         <ul className="playlist">
//           {playlist.map((track, index) => (
//             <li key={index} className="playlist-item">
//               <span className="track-info">{track.title} - {track.artist}</span>
//               <a 
//                 href={track.url} 
//                 target="_blank" 
//                 rel="noopener noreferrer"
//                 className="spotify-link"
//               >
//                 Listen on Spotify
//               </a>
//             </li>
//           ))}
//         </ul>
//       </main>
//     </div>
//   );
// }

// export default PlayRoom;

// // components/PlayRoom.js
// import React, { useState, useEffect, useRef } from 'react';
// import { useLocation, useNavigate } from 'react-router-dom';

// function PlayRoom() {
//   const [playlist, setPlaylist] = useState([]);
//   const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
//   const location = useLocation();
//   const navigate = useNavigate();
//   const embedRef = useRef(null);

//   const [roomName, setRoomName] = useState('');
//   const [moderation, setModeration] = useState('no');
//   const [isHost, setIsHost] = useState(false);

//   useEffect(() => {
//     const params = new URLSearchParams(location.search);
//     const roomNameParam = params.get('room_name');
//     setRoomName(roomNameParam || '');
//     setModeration(params.get('moderation') || 'no');
//     setIsHost(params.get('is_host') === 'True');

//     if (!roomNameParam) {
//       navigate('/homepage');
//       return;
//     }

//     const fetchPlaylist = async () => {
//       try {
//         const response = await fetch(`http://127.0.0.1:4999/api/room-playlist?room_name=${roomNameParam}`);
//         const data = await response.json();
//         setPlaylist(data.playlist);
//       } catch (error) {
//         console.error('Error fetching playlist:', error);
//       }
//     };

//     fetchPlaylist();

//     // Load Spotify Embed API
//     const script = document.createElement('script');
//     script.src = 'https://open.spotify.com/embed/iframe-api/v1';
//     script.async = true;
//     document.body.appendChild(script);

//     return () => {
//       document.body.removeChild(script);
//     };
//   }, [location, navigate]);

//   // ... (rest of the component code remains the same)
//   useEffect(() => {
//     if (playlist.length > 0) {
//       window.onSpotifyIframeApiReady = (IFrameAPI) => {
//         const element = embedRef.current;
//         const options = {
//           width: '100%',
//           height: '160',
//           uri: playlist[currentTrackIndex].uri
//         };
//         const callback = (EmbedController) => {
//           // You can add additional controls here if needed
//         };
//         IFrameAPI.createController(element, options, callback);
//       };
//     }
//   }, [playlist, currentTrackIndex]);

//   const playTrack = (index) => {
//     setCurrentTrackIndex(index);
//   };

//   return (
//     <div className="play-room">
//       <h1>Room: {roomName}</h1>
//       <p>You are {isHost ? 'the host' : 'a guest'}</p>
//       <p>Moderation: {moderation}</p>
      
//       <div id="embed-iframe" ref={embedRef}></div>

//       <div className="upcoming-tracks">
//         <h2>Playlist</h2>
//         <div className="episodes">
//           {playlist.map((track, index) => (
//             <button
//               key={index}
//               className="episode"
//               data-spotify-id={track.uri}
//               onClick={() => playTrack(index)}
//             >
//               {track.title} - {track.artist}
//             </button>
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// }

// export default PlayRoom;


// // components/PlayRoom.js
// import React, { useState, useEffect, useRef } from 'react';
// import { useLocation, useNavigate } from 'react-router-dom';

// function PlayRoom() {
//   const [playlist, setPlaylist] = useState([]);
//   const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
//   const location = useLocation();
//   const navigate = useNavigate();
//   const queryParams = new URLSearchParams(location.search);
//   const roomName = queryParams.get('room_name');
//   const isHost = queryParams.get('is_host') === 'True';
//   const embedRef = useRef(null);

//   useEffect(() => {
//     if (!roomName) {
//       navigate('/homepage');
//       return;
//     }

//     const fetchPlaylist = async () => {
//       try {
//         const response = await fetch(`http://127.0.0.1:4999/api/room-playlist?room_name=${roomName}`);
//         const data = await response.json();
//         setPlaylist(data.playlist);
//       } catch (error) {
//         console.error('Error fetching playlist:', error);
//       }
//     };

//     fetchPlaylist();

//     // Load Spotify Embed API
//     const script = document.createElement('script');
//     script.src = 'https://open.spotify.com/embed/iframe-api/v1';
//     script.async = true;
//     document.body.appendChild(script);

//     return () => {
//       document.body.removeChild(script);
//     };
//   }, [roomName, navigate]);

//   useEffect(() => {
//     if (playlist.length > 0) {
//       window.onSpotifyIframeApiReady = (IFrameAPI) => {
//         const element = embedRef.current;
//         const options = {
//           width: '100%',
//           height: '160',
//           uri: playlist[currentTrackIndex].uri
//         };
//         const callback = (EmbedController) => {
//           // You can add additional controls here if needed
//         };
//         IFrameAPI.createController(element, options, callback);
//       };
//     }
//   }, [playlist, currentTrackIndex]);

//   const playTrack = (index) => {
//     setCurrentTrackIndex(index);
//   };

//   return (
//     <div className="play-room">
//       <h1>Room: {roomName}</h1>
//       <p>You are {isHost ? 'the host' : 'a guest'}</p>
      
//       <div id="embed-iframe" ref={embedRef}></div>

//       <div className="upcoming-tracks">
//         <h2>Playlist</h2>
//         <div className="episodes">
//           {playlist.map((track, index) => (
//             <button
//               key={index}
//               className="episode"
//               data-spotify-id={track.uri}
//               onClick={() => playTrack(index)}
//             >
//               {track.title} - {track.artist}
//             </button>
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// }

// export default PlayRoom;