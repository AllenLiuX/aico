import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './PlayRoom.css';

function PlayRoom() {
  // State variables
  const [playlist, setPlaylist] = useState([]);
  const [introduction, setIntroduction] = useState('');
  const [settings, setSettings] = useState({});
  const [showTooltip, setShowTooltip] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Router hooks
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get roomName from URL query parameters
  const queryParams = new URLSearchParams(location.search);
  const roomName = queryParams.get('room_name');
  const isHost = queryParams.get('is_host') === 'True';

  // Reference for YouTube iframe API
  const playerRef = useRef(null);
  const playerContainerRef = useRef(null);

  // Fetch playlist when component mounts or room name changes
  useEffect(() => {
    if (!roomName) {
      navigate('/homepage');
      return;
    }

    const fetchRoomData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://13.56.253.58:5000/api/room-playlist?room_name=${roomName}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch playlist (${response.status})`);
        }
        
        const data = await response.json();
        console.log('Fetched playlist data:', data);
        
        setPlaylist(data.playlist || []);
        setIntroduction(data.introduction || '');
        setSettings(data.settings || {});
        setLoading(false);
      } catch (error) {
        console.error('Error fetching room data:', error);
        setError(`Failed to load playlist: ${error.message}`);
        setLoading(false);
      }
    };

    fetchRoomData();
  }, [roomName, navigate]);

  // Load YouTube iframe API
  useEffect(() => {
    if (playlist.length === 0 || loading || error) return;

    // Don't create multiple script tags
    if (document.getElementById('youtube-iframe-api')) {
      initPlayer();
      return;
    }

    const tag = document.createElement('script');
    tag.id = 'youtube-iframe-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = initPlayer;

    return () => {
      window.onYouTubeIframeAPIReady = null;
    };
  }, [playlist, loading, error]);

  // Initialize YouTube Player
  const initPlayer = () => {
    if (!playlist.length || !window.YT || !playerContainerRef.current) return;

    try {
      if (playerRef.current) {
        playerRef.current.destroy();
      }

      const videoId = extractVideoId(playlist[currentTrack].url);
      
      playerRef.current = new window.YT.Player(playerContainerRef.current, {
        height: '0',
        width: '0',
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          origin: window.location.origin
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
          onError: onPlayerError
        }
      });
    } catch (err) {
      console.error("Error initializing YouTube player:", err);
      setError(`Failed to initialize player: ${err.message}`);
    }
  };

  // Extract video ID from YouTube URL
  const extractVideoId = (url) => {
    if (!url) return '';
    const match = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/);
    return match ? match[1] : '';
  };

  // Player event handlers
  const onPlayerReady = (event) => {
    if (isPlaying) {
      event.target.playVideo();
    }
  };

  const onPlayerStateChange = (event) => {
    // YT.PlayerState.ENDED = 0
    if (event.data === 0) {
      playNext();
    }
    
    // Update playing state based on player state
    setIsPlaying(event.data === 1); // YT.PlayerState.PLAYING = 1
  };

  const onPlayerError = (event) => {
    console.error("YouTube player error:", event.data);
    setError(`Player error: ${getPlayerErrorMessage(event.data)}`);
  };

  // Get error message based on YouTube error code
  const getPlayerErrorMessage = (errorCode) => {
    switch(errorCode) {
      case 2: return "Invalid video ID";
      case 5: return "HTML5 player error";
      case 100: return "Video not found or removed";
      case 101: 
      case 150: return "Video cannot be played in embedded players";
      default: return `Unknown error (code: ${errorCode})`;
    }
  };

  // Player controls
  const togglePlay = () => {
    if (!playerRef.current) return;
    
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const playNext = () => {
    if (playlist.length === 0) return;
    const nextIndex = (currentTrack + 1) % playlist.length;
    setCurrentTrack(nextIndex);
    loadVideo(nextIndex);
  };

  const playPrevious = () => {
    if (playlist.length === 0) return;
    const prevIndex = (currentTrack - 1 + playlist.length) % playlist.length;
    setCurrentTrack(prevIndex);
    loadVideo(prevIndex);
  };

  const loadVideo = (index) => {
    if (!playerRef.current || !playlist[index]) return;
    
    const videoId = extractVideoId(playlist[index].url);
    if (!videoId) {
      setError("Invalid video URL");
      return;
    }
    
    playerRef.current.loadVideoById(videoId);
    setIsPlaying(true);
  };

  const playSpecificTrack = (index) => {
    setCurrentTrack(index);
    loadVideo(index);
  };

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

  // Render loading state
  if (loading) {
    return (
      <div className="play-room loading">
        <div className="loader"></div>
        <p>Loading playlist...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="play-room error">
        <h2>Something went wrong</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/homepage')} className="back-button">Go Back</button>
      </div>
    );
  }

  // Get current track info
  const currentSong = playlist[currentTrack] || {};

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
      
      <div className="player-grid">
        <div className="player-container">
          <div className="album-art">
            {currentSong.cover_img_url ? (
              <img 
                src={currentSong.cover_img_url} 
                alt={`${currentSong.title} cover`} 
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://i.scdn.co/image/ab67616d0000b2730b66bb2555bb1d5a0d0c42d7';
                }}
              />
            ) : (
              <div className="placeholder-art">
                <span>♪</span>
              </div>
            )}
          </div>
          
          <div className="song-info">
            <h2>{currentSong.title}</h2>
            <p>{currentSong.artist}</p>
          </div>
          
          <div className="controls">
            <button onClick={playPrevious} className="control-button previous">
              ⏮
            </button>
            <button onClick={togglePlay} className="control-button play-pause">
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button onClick={playNext} className="control-button next">
              ⏭
            </button>
          </div>

          {/* Hidden container for YouTube API player */}
          <div ref={playerContainerRef} id="youtube-player" style={{ display: 'none' }}></div>
        </div>

        <div className="playlist-section">
          <div className="playlist-header">
            <h3>Playlist ({playlist.length} songs)</h3>
            <button onClick={handleSearchMusic} className="search-music-button">
              Add Music
            </button>
          </div>
          <ul className="track-list">
            {playlist.map((track, index) => (
              <li 
                key={index}
                className={index === currentTrack ? 'active' : ''}
                onClick={() => playSpecificTrack(index)}
              >
                {track.cover_img_url && (
                  <img 
                    src={track.cover_img_url} 
                    alt=""
                    className="track-thumbnail"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                    }}
                  />
                )}
                <span className="track-number">{index + 1}</span>
                <div className="track-details">
                  <span className="track-title">{track.title}</span>
                  <span className="track-artist">{track.artist}</span>
                </div>
                {index === currentTrack && (
                  <span className="now-playing">▶</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section className="playlist-info">
        <h2>Playlist Information</h2>
        <p>{introduction}</p>
        {settings && (
          <div className="playlist-settings">
            <h3>Playlist Settings</h3>
            <p><strong>Prompt:</strong> {settings.prompt}</p>
            <p><strong>Genre:</strong> {settings.genre}</p>
            <p><strong>Occasion:</strong> {settings.occasion}</p>
          </div>
        )}
      </section>

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

// import React, { useState, useEffect, useCallback } from 'react';
// import { useLocation, useNavigate } from 'react-router-dom';
// import MusicPlayer from './MusicPlayer'; // Import the MusicPlayer component
// import './PlayRoom.css';

// function PlayRoom() {
//   const [playlist, setPlaylist] = useState([]);
//   const [introduction, setIntroduction] = useState('');
//   const [settings, setSettings] = useState({});
//   const [showTooltip, setShowTooltip] = useState(false);
//   const [showQRCode, setShowQRCode] = useState(false);
//   const [currentSongIndex, setCurrentSongIndex] = useState(0);
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

//     const fetchRoomData = async () => {
//       try {
//         const response = await fetch(`http://13.56.253.58:5000/api/room-playlist?room_name=${roomName}`);
//         const data = await response.json();
//         console.log('Fetched playlist data:', data);
//         setPlaylist(data.playlist);
//         setIntroduction(data.introduction);
//         setSettings(data.settings);
//       } catch (error) {
//         console.error('Error fetching room data:', error);
//       }
//     };

//     fetchRoomData();
//   }, [roomName, navigate]);

//   const copyShareLink = () => {
//     const shareLink = `http://aico-music.com/playroom?room_name=${roomName}`;

//     if (navigator.clipboard) {
//       navigator.clipboard.writeText(shareLink).then(() => {
//         setShowTooltip(true);
//         setTimeout(() => setShowTooltip(false), 2000);
//       }).catch(err => {
//         console.error('Failed to copy: ', err);
//       });
//     } else {
//       // Fallback for older browsers
//       const tempInput = document.createElement('input');
//       tempInput.value = shareLink;
//       document.body.appendChild(tempInput);
//       tempInput.select();
//       document.execCommand('copy');
//       document.body.removeChild(tempInput);
//       setShowTooltip(true);
//       setTimeout(() => setShowTooltip(false), 2000);
//     }
//   };

//   const handleQRCodeClick = () => {
//     setShowQRCode(true);
//   };

//   const handleCloseQRCode = () => {
//     setShowQRCode(false);
//   };

//   const handleSaveQRCode = () => {
//     const link = document.createElement('a');
//     link.href = `${process.env.PUBLIC_URL}/images/qr_code_${roomName}.png`;
//     link.download = `qr_code_${roomName}.png`;
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//   };

//   const handleSearchMusic = () => {
//     navigate(`/search_music?room=${roomName}`);
//   };

//   // Prepare the songs array for MusicPlayer in the format it expects
//   const preparePlayerSongs = useCallback(() => {
//     if (!playlist || playlist.length === 0) {
//       return [];
//     }
    
//     return playlist.map(track => ({
//       url: track.url,
//       title: track.title,
//       artist: track.artist,
//       img: track.image_url || "https://i.scdn.co/image/ab67616d0000b2730b66bb2555bb1d5a0d0c42d7" // Default image if none provided
//     }));
//   }, [playlist]);

//   const playerSongs = preparePlayerSongs();

//   return (
//     <div className="play-room">
//       <header>
//         <div className="room-info">
//           <h1>Room: {roomName}</h1>
//           <p>You are {isHost ? 'the host' : 'a guest'}</p>
//           <button onClick={handleQRCodeClick} className="qr-code-button">
//             QR Code
//           </button>
//         </div>
//         <div className="share-button-container">
//           <button onClick={copyShareLink} className="share-button">
//             Share Room and Invite Friends ⚡️
//           </button>
//           {showTooltip && <div className="tooltip">Link copied!</div>}
//         </div>
//       </header>
      
//       {/* MusicPlayer component */}
//       <div className="music-player-container">
//         {playerSongs.length > 0 ? (
//           <MusicPlayer songs={playerSongs} initialSong={currentSongIndex} />
//         ) : (
//           <div className="player-placeholder">
//             <p>No songs available in this playlist. Try adding some!</p>
//           </div>
//         )}
//       </div>

//       <section className="playlist-info">
//         <h2>Playlist Information</h2>
//         <p>{introduction}</p>
//         <div className="playlist-settings">
//           <h3>Playlist Settings</h3>
//           <p><strong>Prompt:</strong> {settings.prompt}</p>
//           <p><strong>Genre:</strong> {settings.genre}</p>
//           <p><strong>Occasion:</strong> {settings.occasion}</p>
//         </div>
//       </section>

//       <main className="playlist-container">
//         <h2>The Playlist</h2>
//         <button onClick={handleSearchMusic} className="search-music-button">Search and Add Music</button>  
//         <ul className="playlist">
//           {playlist.map((track, index) => (
//             <li 
//               key={index} 
//               className={`playlist-item ${currentSongIndex === index ? 'active' : ''}`}
//               onClick={() => setCurrentSongIndex(index)}
//             >
//               <span className="track-info">{track.title} - {track.artist}</span>
//               <a 
//                 href={track.url} 
//                 target="_blank" 
//                 rel="noopener noreferrer"
//                 className="external-link"
//                 onClick={(e) => e.stopPropagation()}
//               >
//                 Listen on YouTube
//               </a>
//             </li>
//           ))}
//         </ul>
//       </main>

//       {showQRCode && (
//         <div className="qr-code-overlay">
//           <div className="qr-code-modal">
//             <img src={`${process.env.PUBLIC_URL}/images/qr_code_${roomName}.png`} alt="Room QR Code" />
//             <button onClick={handleSaveQRCode}>Save QR Code</button>
//             <button onClick={handleCloseQRCode}>Close</button>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// export default PlayRoom;

// import React, { useState, useEffect, useCallback } from 'react';
// import { useLocation, useNavigate } from 'react-router-dom';

// function PlayRoom() {
//   const [playlist, setPlaylist] = useState([]);
//   const [introduction, setIntroduction] = useState('');
//   const [settings, setSettings] = useState({});
//   const [showTooltip, setShowTooltip] = useState(false);
//   const [showQRCode, setShowQRCode] = useState(false);
//   const [firstTrackId, setFirstTrackId] = useState(null);
//   const [spotifyPlayerError, setSpotifyPlayerError] = useState(null);
//   const location = useLocation();
//   const navigate = useNavigate();
//   const queryParams = new URLSearchParams(location.search);
//   const roomName = queryParams.get('room_name');
//   const isHost = queryParams.get('is_host') === 'True';

//   const setupSpotifyPlayer = useCallback(() => {
//     if (!firstTrackId) return;

//     console.log("Setting up Spotify player with track ID:", firstTrackId);

//     const script = document.createElement('script');
//     script.src = "https://open.spotify.com/embed/iframe-api/v1";
//     script.async = true;
//     script.onload = () => {
//       window.onSpotifyIframeApiReady = (IFrameAPI) => {
//         const element = document.getElementById('embed-iframe');
//         const options = {
//           width: '100%',
//           height: '160',
//           uri: `spotify:track:${firstTrackId}`,
//           allow: "encrypted-media; clipboard-write; autoplay",
//         };
//         const callback = (EmbedController) => {
//           EmbedController.addListener('playback_error', (e) => {
//             console.error('Spotify playback error:', e);
//             setSpotifyPlayerError(`Playback error: ${e.message}`);
//           });

//           document.querySelectorAll('.episode').forEach(episode => {
//             episode.addEventListener('click', () => {
//               EmbedController.loadUri(episode.dataset.spotifyId);
//             });
//           });
//         };
//         IFrameAPI.createController(element, options, callback);
//       };
//     };
//     document.body.appendChild(script);

//     return () => {
//       document.body.removeChild(script);
//     };
//   }, [firstTrackId]);

//   useEffect(() => {
//     if (!roomName) {
//       navigate('/homepage');
//       return;
//     }

//     const fetchRoomData = async () => {
//       try {

//         // const response = await fetch(`http://127.0.0.1:5000/api/room-playlist?room_name=${roomName}`);

//         const response = await fetch(`http://13.56.253.58:5000/api/room-playlist?room_name=${roomName}`);
//         const data = await response.json();
//         console.log(data)
//         setPlaylist(data.playlist);
//         setIntroduction(data.introduction);
//         setSettings(data.settings);
//         if (data.playlist.length > 0) {
//           console.log("Setting firstTrackId:", data.playlist[0].id);
//           setFirstTrackId(data.playlist[0].id);
//         }
//       } catch (error) {
//         console.error('Error fetching room data:', error);
//       }
//     };

//     fetchRoomData();
//   }, [roomName, navigate]);

//   useEffect(() => {
//     if (firstTrackId) {
//       setupSpotifyPlayer();
//     }
//   }, [firstTrackId, setupSpotifyPlayer]);

//   const copyShareLink = () => {
//     const shareLink = `http://aico-music.com/playroom?room_name=${roomName}`;

//     if (navigator.clipboard) {
//       navigator.clipboard.writeText(shareLink).then(() => {
//         setShowTooltip(true);
//         setTimeout(() => setShowTooltip(false), 2000);
//       }).catch(err => {
//         console.error('Failed to copy: ', err);
//       });
//     } else {
//       // Fallback for older browsers
//       const tempInput = document.createElement('input');
//       tempInput.value = shareLink;
//       document.body.appendChild(tempInput);
//       tempInput.select();
//       document.execCommand('copy');
//       document.body.removeChild(tempInput);
//       setShowTooltip(true);
//       setTimeout(() => setShowTooltip(false), 2000);
//     }
//   };

//   const handleQRCodeClick = () => {
//     setShowQRCode(true);
//   };

//   const handleCloseQRCode = () => {
//     setShowQRCode(false);
//   };

//   const handleSaveQRCode = () => {
//     const link = document.createElement('a');
//     link.href = `${process.env.PUBLIC_URL}/images/qr_code_${roomName}.png`;
//     link.download = `qr_code_${roomName}.png`;
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//   };

//   const handleSearchMusic = () => {
//     navigate(`/search_music?room=${roomName}`);
//   };



//   // //  Function to manually test different track IDs
//   //  const testTrackId = (id) => {
//   //   setFirstTrackId(id);
//   // };  

//   return (
//     <div className="play-room">
//       <header>
//         <div className="room-info">
//           <h1>Room: {roomName}</h1>
//           <p>You are {isHost ? 'the host' : 'a guest'}</p>
//           <button onClick={handleQRCodeClick} className="qr-code-button">
//             QR Code
//           </button>
//         </div>
//         <div className="share-button-container">
//           <button onClick={copyShareLink} className="share-button">
//             Share Room and Invite Friends ⚡️
//           </button>
//           {showTooltip && <div className="tooltip">Link copied!</div>}
//         </div>
//       </header>
      
//       {/* <div className="debug-section">
//         <h3>Debug: Spotify Track ID</h3>
//         <p>Current Track ID: {firstTrackId}</p>
//         <input 
//           type="text" 
//           placeholder="Enter Spotify Track ID" 
//           onChange={(e) => testTrackId(e.target.value)}
//         />
//       </div> */}
//       <div id="embed-iframe"></div>
//       {spotifyPlayerError && <p className="error-message">{spotifyPlayerError}</p>}

//       {/* Debug section */}
//       {/* <div className="debug-section">
//         <h3>Debug: Spotify Track ID</h3>
//         <p>Current Track ID: {firstTrackId}</p>
//       </div> */}

//       {/* <main className="playlist-container">
//         <h2>The Playlist</h2>
//         <ul className="playlist">
//           {playlist.map((track, index) => (
//             <li key={index} className="playlist-item">
//               <span className="track-info">{track.title} - {track.artist}</span>
//               <span className="track-id">ID: {track.id}</span>
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
//       </main> */}

//       {/* <div id="embed-iframe"></div> */}

//       <section className="playlist-info">
//         <h2>Playlist Information</h2>
//         <p>{introduction}</p>
//         <div className="playlist-settings">
//           <h3>Playlist Settings</h3>
//           <p><strong>Prompt:</strong> {settings.prompt}</p>
//           <p><strong>Genre:</strong> {settings.genre}</p>
//           <p><strong>Occasion:</strong> {settings.occasion}</p>
//         </div>
//       </section>

//       <main className="playlist-container">
//         <h2>The Playlist</h2>
//         <button onClick={handleSearchMusic} className="qr-code-button">Search and Add Music</button>  
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

//       {showQRCode && (
//         <div className="qr-code-overlay">
//           <div className="qr-code-modal">
//             <img src={`${process.env.PUBLIC_URL}/images/qr_code_${roomName}.png`} alt="Room QR Code" />
//             <button onClick={handleSaveQRCode}>Save QR Code</button>
//             <button onClick={handleCloseQRCode}>Close</button>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// export default PlayRoom;





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
