// components/PlayRoom.js
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function PlayRoom() {
  const [playlist, setPlaylist] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const roomName = queryParams.get('room_name');
  const isHost = queryParams.get('is_host') === 'True';
  const embedRef = useRef(null);

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

    // Load Spotify Embed API
    const script = document.createElement('script');
    script.src = 'https://open.spotify.com/embed/iframe-api/v1';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [roomName, navigate]);

  useEffect(() => {
    if (playlist.length > 0) {
      window.onSpotifyIframeApiReady = (IFrameAPI) => {
        const element = embedRef.current;
        const options = {
          width: '100%',
          height: '160',
          uri: playlist[currentTrackIndex].uri
        };
        const callback = (EmbedController) => {
          // You can add additional controls here if needed
        };
        IFrameAPI.createController(element, options, callback);
      };
    }
  }, [playlist, currentTrackIndex]);

  const playTrack = (index) => {
    setCurrentTrackIndex(index);
  };

  return (
    <div className="play-room">
      <h1>Room: {roomName}</h1>
      <p>You are {isHost ? 'the host' : 'a guest'}</p>
      
      <div id="embed-iframe" ref={embedRef}></div>

      <div className="upcoming-tracks">
        <h2>Playlist</h2>
        <div className="episodes">
          {playlist.map((track, index) => (
            <button
              key={index}
              className="episode"
              data-spotify-id={track.uri}
              onClick={() => playTrack(index)}
            >
              {track.title} - {track.artist}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PlayRoom;