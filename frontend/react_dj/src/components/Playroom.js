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
  const [showQRCode, setShowQRCode] = useState(false);

  useEffect(() => {
    if (!roomName) {
      navigate('/homepage');
      return;
    }

    const fetchPlaylist = async () => {
      try {
        const response = await fetch(`http://13.56.253.58:5000/api/room-playlist?room_name=${roomName}`);
        const data = await response.json();
        setPlaylist(data.playlist);
      } catch (error) {
        console.error('Error fetching playlist:', error);
      }
    };

    fetchPlaylist();
  }, [roomName, navigate]);

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

  useEffect(() => {
    // Load Spotify IFrame API
    const script = document.createElement('script');
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.async = true;
    script.onload = () => {
      window.onSpotifyIframeApiReady = (IFrameAPI) => {
        const element = document.getElementById('embed-iframe');
        const options = {
          width: '100%',
          height: '160',
          uri: 'spotify:track:39uLYYZytVUwcjgeYLI409',
          // allow: "encrypted-media"
          allow: "encrypted-media; clipboard-write; autoplay" ,
        };
        // track/39uLYYZytVUwcjgeYLI409?utm_source=generator
        const callback = (EmbedController) => {
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
    
    // Cleanup script on component unmount
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="play-room">
      <header>
        <div className="room-info">
          <h1>Room: {roomName}</h1>
          <p>You are {isHost ? 'the host' : 'a guest'}</p>
          <button onClick={handleQRCodeClick}>
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

      <div id="embed-iframe"></div>

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
