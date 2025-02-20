import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function PlayRoom() {
  const [playlist, setPlaylist] = useState([]);
  const [introduction, setIntroduction] = useState('');
  const [settings, setSettings] = useState({});
  const [showTooltip, setShowTooltip] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [firstTrackId, setFirstTrackId] = useState(null);
  const [spotifyPlayerError, setSpotifyPlayerError] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const roomName = queryParams.get('room_name');
  const isHost = queryParams.get('is_host') === 'True';

  const setupSpotifyPlayer = useCallback(() => {
    if (!firstTrackId) return;

    console.log("Setting up Spotify player with track ID:", firstTrackId);

    const script = document.createElement('script');
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.async = true;
    script.onload = () => {
      window.onSpotifyIframeApiReady = (IFrameAPI) => {
        const element = document.getElementById('embed-iframe');
        const options = {
          width: '100%',
          height: '160',
          uri: `spotify:track:${firstTrackId}`,
          allow: "encrypted-media; clipboard-write; autoplay",
        };
        const callback = (EmbedController) => {
          EmbedController.addListener('playback_error', (e) => {
            console.error('Spotify playback error:', e);
            setSpotifyPlayerError(`Playback error: ${e.message}`);
          });

          document.querySelectorAll('.episode').forEach(episode => {
            episode.addEventListener('click', () => {
              EmbedController.loadUri(episode.dataset.spotifyId);
            });
          });
        };
        IFrameAPI.createController(element, options, callback);
      };
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [firstTrackId]);

  useEffect(() => {
    if (!roomName) {
      navigate('/homepage');
      return;
    }

    const fetchRoomData = async () => {
      try {

        // const response = await fetch(`http://127.0.0.1:5000/api/room-playlist?room_name=${roomName}`);

        const response = await fetch(`http://13.56.253.58:5000/api/room-playlist?room_name=${roomName}`);
        const data = await response.json();
        console.log(data)
        setPlaylist(data.playlist);
        setIntroduction(data.introduction);
        setSettings(data.settings);
        if (data.playlist.length > 0) {
          console.log("Setting firstTrackId:", data.playlist[0].id);
          setFirstTrackId(data.playlist[0].id);
        }
      } catch (error) {
        console.error('Error fetching room data:', error);
      }
    };

    fetchRoomData();
  }, [roomName, navigate]);

  useEffect(() => {
    if (firstTrackId) {
      setupSpotifyPlayer();
    }
  }, [firstTrackId, setupSpotifyPlayer]);

  const copyShareLink = () => {
    const shareLink = `http://aico-music.com/playroom?room_name=${roomName}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareLink).then(() => {
        setShowTooltip(true);
        setTimeout(() => setShowTooltip(false), 2000);
      }).catch(err => {
        console.error('Failed to copy: ', err);
      });
    } else {
      // Fallback for older browsers
      const tempInput = document.createElement('input');
      tempInput.value = shareLink;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 2000);
    }
  };

  const handleQRCodeClick = () => {
    setShowQRCode(true);
  };

  const handleCloseQRCode = () => {
    setShowQRCode(false);
  };

  const handleSaveQRCode = () => {
    const link = document.createElement('a');
    link.href = `${process.env.PUBLIC_URL}/images/qr_code_${roomName}.png`;
    link.download = `qr_code_${roomName}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSearchMusic = () => {
    navigate(`/search_music?room=${roomName}`);
  };



  // //  Function to manually test different track IDs
  //  const testTrackId = (id) => {
  //   setFirstTrackId(id);
  // };  

  return (
    <div className="play-room">
      <header>
        <div className="room-info">
          <h1>Room: {roomName}</h1>
          <p>You are {isHost ? 'the host' : 'a guest'}</p>
          <button onClick={handleQRCodeClick} className="qr-code-button">
            QR Code
          </button>
        </div>
        <div className="share-button-container">
          <button onClick={copyShareLink} className="share-button">
            Share Room and Invite Friends ⚡️
          </button>
          {showTooltip && <div className="tooltip">Link copied!</div>}
        </div>
      </header>
      
      {/* <div className="debug-section">
        <h3>Debug: Spotify Track ID</h3>
        <p>Current Track ID: {firstTrackId}</p>
        <input 
          type="text" 
          placeholder="Enter Spotify Track ID" 
          onChange={(e) => testTrackId(e.target.value)}
        />
      </div> */}
      <div id="embed-iframe"></div>
      {spotifyPlayerError && <p className="error-message">{spotifyPlayerError}</p>}

      {/* Debug section */}
      {/* <div className="debug-section">
        <h3>Debug: Spotify Track ID</h3>
        <p>Current Track ID: {firstTrackId}</p>
      </div> */}

      {/* <main className="playlist-container">
        <h2>The Playlist</h2>
        <ul className="playlist">
          {playlist.map((track, index) => (
            <li key={index} className="playlist-item">
              <span className="track-info">{track.title} - {track.artist}</span>
              <span className="track-id">ID: {track.id}</span>
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
      </main> */}

      {/* <div id="embed-iframe"></div> */}

      <section className="playlist-info">
        <h2>Playlist Information</h2>
        <p>{introduction}</p>
        <div className="playlist-settings">
          <h3>Playlist Settings</h3>
          <p><strong>Prompt:</strong> {settings.prompt}</p>
          <p><strong>Genre:</strong> {settings.genre}</p>
          <p><strong>Occasion:</strong> {settings.occasion}</p>
        </div>
      </section>

      <main className="playlist-container">
        <h2>The Playlist</h2>
        <button onClick={handleSearchMusic} className="qr-code-button">Search and Add Music</button>  
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

      {showQRCode && (
        <div className="qr-code-overlay">
          <div className="qr-code-modal">
            <img src={`${process.env.PUBLIC_URL}/images/qr_code_${roomName}.png`} alt="Room QR Code" />
            <button onClick={handleSaveQRCode}>Save QR Code</button>
            <button onClick={handleCloseQRCode}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlayRoom;


// // Updated PlayRoom.js with Spotify Web Playback SDK Integration

// import React, { useEffect, useState } from 'react';

// const SPOTIFY_CLIENT_ID = '1bf7160dc56446378b569f7a74064a12'; // Replace with your Spotify Client ID
// const REDIRECT_URI = 'http://localhost:3000/callback'; // Update this if your redirect URI differs

// const PlayRoom = ({ playlist, roomName }) => {
//   const [spotifyPlayer, setSpotifyPlayer] = useState(null);
//   const [isAuthorized, setIsAuthorized] = useState(false);

//   const getSpotifyToken = () => {
//     const hash = window.location.hash;
//     const token = hash
//       .substring(1)
//       .split('&')
//       .find(elem => elem.startsWith('access_token'))
//       ?.split('=')[1];
//     return token;
//   };

//   const loginToSpotify = () => {
//     const scope = 'streaming user-read-email user-read-private';
//     const authURL = `https://accounts.spotify.com/authorize?response_type=token&client_id=${SPOTIFY_CLIENT_ID}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
//     window.location.href = authURL;
//   };

//   useEffect(() => {
//     const token = getSpotifyToken();
//     if (!token) {
//       loginToSpotify();
//       return;
//     }

//     setIsAuthorized(true);

//     const script = document.createElement('script');
//     script.src = 'https://sdk.scdn.co/spotify-player.js';
//     script.async = true;
//     document.body.appendChild(script);

//     window.onSpotifyWebPlaybackSDKReady = () => {
//       const player = new window.Spotify.Player({
//         name: 'PlayRoom Player',
//         getOAuthToken: cb => { cb(token); },
//         volume: 0.8,
//       });

//       player.connect();

//       player.addListener('ready', ({ device_id }) => {
//         console.log('Device ID:', device_id);
//       });

//       player.addListener('player_state_changed', state => {
//         console.log('Player state changed:', state);
//       });

//       setSpotifyPlayer(player);
//     };
//   }, []);

//   const playTrack = async (spotifyUri) => {
//     if (!spotifyPlayer) {
//       alert('Player is not ready yet. Please wait.');
//       return;
//     }

//     const token = getSpotifyToken();
//     const deviceId = spotifyPlayer._options.id;

//     await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
//       method: 'PUT',
//       headers: {
//         Authorization: `Bearer ${token}`,
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({ uris: [spotifyUri] }),
//     });
//   };

//   return (
//     <div className="playroom">
//       <header>
//         <h1>Welcome to {roomName} PlayRoom</h1>
//       </header>

//       {!isAuthorized && <p>Redirecting to Spotify for authentication...</p>}

//       {isAuthorized && (
//         <div className="playlist-container">
//           <h2>Playlist</h2>
//           {playlist.map((track, index) => (
//             <div key={index} className="track-item">
//               <p>
//                 <strong>{track.title}</strong> by {track.artist}
//               </p>
//               <button onClick={() => playTrack(track.id)}>Play</button>
//             </div>
//           ))}
//         </div>
//       )}

//       <footer>
//         <button onClick={() => alert('Back to Room Selection!')}>Back</button>
//       </footer>
//     </div>
//   );
// };

// export default PlayRoom;
