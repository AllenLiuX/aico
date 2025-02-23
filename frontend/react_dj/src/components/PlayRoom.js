// PlayRoom.js
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PlaylistTrack from './PlaylistTrack'; 

import { 
  Play, Pause, SkipBack, SkipForward, Share2, 
  QrCode, Plus, Music 
} from 'lucide-react';
import '../styles/PlayRoom.css';

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
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const progressIntervalRef = useRef(null);
  const playerRef = useRef(null);
  const playerContainerRef = useRef(null);
  
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

    const fetchRoomData = async () => {
      try {
        setLoading(true);
        // const response = await fetch(`http://127.0.0.1:5000/api/room-playlist?room_name=${roomName}`);
        const response = await fetch(`http://13.56.253.58:5000/api/room-playlist?room_name=${roomName}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch playlist (${response.status})`);
        }
        
        const data = await response.json();
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

  useEffect(() => {
    if (playlist.length === 0 || loading || error) return;
  
    // Initialize player if not already initialized
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
  }, [playlist, loading, error, currentTrack]); // Add currentTrack to dependencies

  const onPlayerError = (event) => {
    console.error("YouTube player error:", event.data);
    const errorMessages = {
      2: "Invalid video ID",
      5: "HTML5 player error",
      100: "Video not found or removed",
      101: "Video cannot be played in embedded players",
      150: "Video cannot be played in embedded players"
    };
    setError(`Player error: ${errorMessages[event.data] || `Unknown error (code: ${event.data})`}`);
  };

  const initPlayer = () => {
    if (!playlist.length || !window.YT || !playerContainerRef.current) return;

    try {
      if (playerRef.current) {
        playerRef.current.destroy();
      }

      const videoId = extractVideoId(playlist[currentTrack].song_url);
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
          origin: window.location.origin,
          playsinline: 1
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

  const extractVideoId = (url) => {
    if (!url) return '';
    const match = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/);
    return match ? match[1] : '';
  };

  const onPlayerReady = (event) => {
    if (isPlaying) {
      event.target.playVideo();
    }
  };

  const onPlayerStateChange = (event) => {
    const playerState = event.data;
    
    if (playerState === 0) {
      setCurrentTrack(prevTrack => {
        const nextIndex = (prevTrack + 1) % playlist.length;
        setTimeout(() => {
          if (playerRef.current) {
            const videoId = extractVideoId(playlist[nextIndex].song_url);
            if (videoId) {
              playerRef.current.loadVideoById(videoId);
            }
          }
        }, 50);
        return nextIndex;
      });
    }
   
    
    const isNowPlaying = playerState === 1;
    setIsPlaying(isNowPlaying);
    
    if (isNowPlaying) {
      startProgressTracking();
    } else {
      stopProgressTracking();
    }
  };

  const startProgressTracking = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    progressIntervalRef.current = setInterval(() => {
      if (playerRef.current) {
        const currentTime = playerRef.current.getCurrentTime() || 0;
        const totalDuration = playerRef.current.getDuration() || 0;
        const progressPercent = (currentTime / totalDuration) * 100 || 0;
        
        setProgress(progressPercent);
        setCurrentTime(currentTime);
        setDuration(totalDuration);
      }
    }, 1000);
  };

  const stopProgressTracking = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

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
    
    // Update currentTrack first
    setCurrentTrack(index);
    
    const videoId = extractVideoId(playlist[index].song_url);
    if (!videoId) {
      setError("Invalid video URL");
      return;
    }
    
    // Load and play the video
    playerRef.current.loadVideoById(videoId);
    setIsPlaying(true);
  };

  // const loadVideo = (index) => {
  //   if (!playerRef.current || !playlist[index]) return;
    
  //   const videoId = extractVideoId(playlist[index].song_url);
  //   if (!videoId) {
  //     setError("Invalid video URL");
  //     return;
  //   }
    
  //   playerRef.current.loadVideoById(videoId);
  //   setIsPlaying(true);
  // };

  const formatTime = (timeInSeconds) => {
    if (!timeInSeconds || isNaN(timeInSeconds)) return "0:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleProgressChange = (e) => {
    if (!playerRef.current) return;
    
    const newProgress = parseFloat(e.target.value);
    setProgress(newProgress);
    
    const seekTime = (newProgress / 100) * duration;
    playerRef.current.seekTo(seekTime, true);
  };

  const copyShareLink = () => {
    const shareLink = `http://aico-music.com/playroom?room_name=${roomName}`;
    navigator.clipboard.writeText(shareLink).then(() => {
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 2000);
    });
  };

  const handleQRCodeClick = () => {
    setShowQRCode(true);
  };

  const handleSearchMusic = () => {
    navigate(`/search_music?room=${roomName}`);
  };

  const playSpecificTrack = (index) => {
    console.log(`Playing specific track at index ${index}:`, playlist[index].title);
    setCurrentTrack(index);
    loadVideo(index);
  };


  if (loading) {
    return (
      <div className="play-room loading">
        <div className="loader"></div>
        <p>Loading playlist...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="play-room error">
        <h2>Something went wrong</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/homepage')} className="back-button">
          Go Back
        </button>
      </div>
    );
  }

  const currentSong = playlist[currentTrack] || {};
  const handleTrackDelete = (newPlaylist) => {
    // Cleanup player state
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  
    // If there are songs remaining in the playlist
    if (newPlaylist.length > 0) {
      // If deleting current track, move to next song or previous if at end
      if (currentTrack >= newPlaylist.length) {
        setCurrentTrack(newPlaylist.length - 1);
      }
      // Load the new track
      const nextVideoId = extractVideoId(newPlaylist[currentTrack].song_url);
      if (playerRef.current && nextVideoId) {
        playerRef.current.loadVideoById(nextVideoId);
      }
    } else {
      // If no songs left, reset player
      setCurrentTrack(0);
      setIsPlaying(false);
      if (playerRef.current) {
        playerRef.current.stopVideo();
      }
    }
  
    // Update playlist
    setPlaylist(newPlaylist);
  };



  // PlayRoom.js
// ... keep all your existing imports and state variables ...

  // Only update the return JSX to match the CSS classes:
  return (
    <div className="play-room">
      <header className="room-header">
        <div className="room-info">
          <h1>{roomName}</h1>
          <p>You are {isHost ? 'the host' : 'a guest'}</p>
        </div>
        <div className="room-controls">
          <button onClick={handleQRCodeClick} className="control-button">
            <QrCode size={20} />
          </button>
          <button onClick={copyShareLink} className="share-button">
            <Share2 size={20} />
            Share Room
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
                  e.target.src = '/api/placeholder/300/300';
                }}
              />
            ) : (
              <div className="placeholder-art">
                <Music size={48} />
              </div>
            )}
          </div>
          
          <div className="song-info">
            <h2>{currentSong.title || 'No track selected'}</h2>
            <p>{currentSong.artist || 'Unknown artist'}</p>
          </div>
          
          <div className="progress-container">
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={handleProgressChange}
              className="progress-bar"
            />
            <div className="time-display">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          
          <div className="player-controls">
            <button onClick={playPrevious} className="control-button">
              <SkipBack size={24} />
            </button>
            <button onClick={togglePlay} className="control-button play-button">
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>
            <button onClick={playNext} className="control-button">
              <SkipForward size={24} />
            </button>
          </div>

          <div ref={playerContainerRef} id="youtube-player"></div>
        </div>

        <div className="playlist-section">
  <div className="playlist-header">
    <h3>Playlist ({playlist.length} songs)</h3>
    <button onClick={handleSearchMusic} className="control-button add-music-button">
              <Plus size={20} />
              Add Music
            </button>
  </div>
  <ul className="track-list">
  {playlist.map((track, index) => (
    <PlaylistTrack
      key={index}
      track={track}
      index={index}
      isHost={isHost}
      isCurrentTrack={index === currentTrack}
      roomName={roomName}
      onTrackClick={playSpecificTrack}
      onTrackDelete={handleTrackDelete}
      stopProgressTracking={stopProgressTracking}  // Pass the existing stopProgressTracking function
    />
  ))}
</ul>
</div>
      </div>

      <div className="playlist-info-section">
        <h2>About this Playlist</h2>
        <p className="playlist-description">{introduction || 'No description available'}</p>
        {settings && Object.keys(settings).length > 0 && (
          <div className="playlist-settings">
            {settings.prompt && (
              <div className="setting-item">
                <span className="setting-label">Prompt:</span>
                <span>{settings.prompt}</span>
              </div>
            )}
            {settings.genre && (
              <div className="setting-item">
                <span className="setting-label">Genre:</span>
                <span>{settings.genre}</span>
              </div>
            )}
            {settings.occasion && (
              <div className="setting-item">
                <span className="setting-label">Occasion:</span>
                <span>{settings.occasion}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {showQRCode && (
        <div className="qr-code-overlay">
          <div className="qr-code-modal">
            <img 
              src={`/images/qr_code_${roomName}.png`} 
              alt="Room QR Code" 
            />
            <div className="qr-code-buttons">
              <button onClick={() => setShowQRCode(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

//   return (
//     <div className="play-room">
//       <header className="room-header">
//         <div className="room-info">
//           <h1>{roomName}</h1>
//           <p>You are {isHost ? 'the host' : 'a guest'}</p>
//         </div>
//         <div className="room-controls">
//           <button onClick={handleQRCodeClick} className="control-button">
//             <QrCode size={20} />
//           </button>
//           <button onClick={copyShareLink} className="share-button">
//             <Share2 size={20} />
//             Share Room
//           </button>
//           {showTooltip && <div className="tooltip">Link copied!</div>}
//         </div>
//       </header>
      
//       <div className="player-grid">
//         <div className="player-container">
//           <div className="album-art">
//             {currentSong.cover_img_url ? (
//               <img 
//                 src={currentSong.cover_img_url} 
//                 alt={`${currentSong.title} cover`} 
//                 onError={(e) => {
//                   e.target.onerror = null;
//                   e.target.src = '/api/placeholder/300/300';
//                 }}
//               />
//             ) : (
//               <div className="placeholder-art">
//                 <Music size={48} />
//               </div>
//             )}
//           </div>
          
//           <div className="song-info">
//             <h2>{currentSong.title || 'No track selected'}</h2>
//             <p>{currentSong.artist || 'Unknown artist'}</p>
//           </div>
          
//           <div className="progress-container">
//             <span className="time-elapsed">{formatTime(currentTime)}</span>
//             <input
//               type="range"
//               min="0"
//               max="100"
//               value={progress}
//               onChange={handleProgressChange}
//               className="progress-bar"
//             />
//             <span className="time-total">{formatTime(duration)}</span>
//           </div>
          
//           <div className="player-controls">
//             <button onClick={playPrevious} className="control-button">
//               <SkipBack size={24} />
//             </button>
//             <button onClick={togglePlay} className="control-button play-button">
//               {isPlaying ? <Pause size={24} /> : <Play size={24} />}
//             </button>
//             <button onClick={playNext} className="control-button">
//               <SkipForward size={24} />
//             </button>
//           </div>

//           <div ref={playerContainerRef} id="youtube-player"></div>
//         </div>

//         <div className="playlist-section">
//           <div className="playlist-header">
//             <h3>Playlist ({playlist.length} songs)</h3>
//             <button onClick={handleSearchMusic} className="add-music-button">
//               <Plus size={20} />
//               Add Music
//             </button>
//           </div>
//           <ul className="track-list">
//             {playlist.map((track, index) => (
//               <li 
//                 key={index}
//                 className={`track-item ${index === currentTrack ? 'active' : ''}`}
//                 onClick={() => loadVideo(index)}
//               >
//                 {track.cover_img_url && (
//                   <img 
//                     src={track.cover_img_url} 
//                     alt=""
//                     className="track-image"
//                     onError={(e) => {
//                       e.target.onerror = null;
//                       e.target.style.display = 'none';
//                     }}
//                   />
//                 )}
//                 <span className="track-number">{index + 1}</span>
//                 <div className="track-details">
//                   <span className="track-title">{track.title}</span>
//                   <span className="track-artist">{track.artist}</span>
//                 </div>
//                 {index === currentTrack && (
//                   <span className="now-playing">{isPlaying ? '▶' : '⏸'}</span>
//                 )}
//               </li>
//             ))}
//           </ul>
//         </div>
//         {/* Add this section right after the player-grid div */}
//         <div className="playlist-info-section">
//           <div className="playlist-info-header">
//             <h2>About this Playlist</h2>
//           </div>
//           <p className="playlist-description">
//             {introduction || 'No description available'}
//           </p>
//           {settings && Object.keys(settings).length > 0 && (
//             <div className="playlist-settings">
//               {settings.prompt && (
//                 <div className="setting-item">
//                   <span className="setting-label">Prompt:</span>
//                   <span className="setting-value">{settings.prompt}</span>
//                 </div>
//               )}
//               {settings.genre && (
//                 <div className="setting-item">
//                   <span className="setting-label">Genre:</span>
//                   <span className="setting-value">{settings.genre}</span>
//                 </div>
//               )}
//               {settings.occasion && (
//                 <div className="setting-item">
//                   <span className="setting-label">Occasion:</span>
//                   <span className="setting-value">{settings.occasion}</span>
//                 </div>
//               )}
//             </div>
//           )}
//         </div>
//       </div>

//       {showQRCode && (
//         <div className="qr-code-overlay">
//           <div className="qr-code-modal">
//             <img 
//               src={`/images/qr_code_${roomName}.png`} 
//               alt="Room QR Code" 
//             />
//             <div className="qr-code-buttons">
//               <button onClick={() => setShowQRCode(false)}>Close</button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

export default PlayRoom;

// import React, { useState, useEffect, useRef } from 'react';
// import { useLocation, useNavigate } from 'react-router-dom';

// import '../styles/PlayRoom.css';

// function PlayRoom() {
//   // State variables
//   const [playlist, setPlaylist] = useState([]);
//   const [introduction, setIntroduction] = useState('');
//   const [settings, setSettings] = useState({});
//   const [showTooltip, setShowTooltip] = useState(false);
//   const [showQRCode, setShowQRCode] = useState(false);
//   const [currentTrack, setCurrentTrack] = useState(0);
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [progress, setProgress] = useState(0);
//   const [duration, setDuration] = useState(0);
//   const [currentTime, setCurrentTime] = useState(0);
//   const progressIntervalRef = useRef(null);
  
//   // Router hooks
//   const location = useLocation();
//   const navigate = useNavigate();
  
//   // Get roomName from URL query parameters
//   const queryParams = new URLSearchParams(location.search);
//   const roomName = queryParams.get('room_name');
//   const isHost = queryParams.get('is_host') === 'True';

//   // Reference for YouTube iframe API
//   const playerRef = useRef(null);
//   const playerContainerRef = useRef(null);

//   // Fetch playlist when component mounts or room name changes
//   useEffect(() => {
//     if (!roomName) {
//       navigate('/homepage');
//       return;
//     }

//     const fetchRoomData = async () => {
//       try {
//         setLoading(true);
//         // const response = await fetch(`http://127.0.0.1:5000/api/room-playlist?room_name=${roomName}`);
//         const response = await fetch(`http://13.56.253.58:5000/api/room-playlist?room_name=${roomName}`);
//         if (!response.ok) {
//           throw new Error(`Failed to fetch playlist (${response.status})`);
//         }
        
//         const data = await response.json();
//         console.log('Fetched playlist data:', data);
        
//         setPlaylist(data.playlist || []);
//         setIntroduction(data.introduction || '');
//         setSettings(data.settings || {});
//         setLoading(false);
//       } catch (error) {
//         console.error('Error fetching room data:', error);
//         setError(`Failed to load playlist: ${error.message}`);
//         setLoading(false);
//       }
//     };

//     fetchRoomData();
//   }, [roomName, navigate]);

//   // Load YouTube iframe API
//   useEffect(() => {
//     if (playlist.length === 0 || loading || error) return;

//     // Don't create multiple script tags
//     if (document.getElementById('youtube-iframe-api')) {
//       initPlayer();
//       return;
//     }

//     const tag = document.createElement('script');
//     tag.id = 'youtube-iframe-api';
//     tag.src = 'https://www.youtube.com/iframe_api';
//     const firstScriptTag = document.getElementsByTagName('script')[0];
//     firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

//     window.onYouTubeIframeAPIReady = initPlayer;

//     return () => {
//       window.onYouTubeIframeAPIReady = null;
//     };
//   }, [playlist, loading, error]);

//   // Initialize YouTube Player
//   const initPlayer = () => {
//     if (!playlist.length || !window.YT || !playerContainerRef.current) return;

//     try {
//       if (playerRef.current) {
//         playerRef.current.destroy();
//       }

//       const videoId = extractVideoId(playlist[currentTrack].song_url);
//       console.log(`Initializing player with video ID: ${videoId} (Track index: ${currentTrack})`);
      
//       playerRef.current = new window.YT.Player(playerContainerRef.current, {
//         height: '0',
//         width: '0',
//         videoId: videoId,
//         playerVars: {
//           autoplay: 1,
//           controls: 0,
//           disablekb: 1,
//           fs: 0,
//           modestbranding: 1,
//           rel: 0,
//           origin: window.location.origin,
//           playsinline: 1
//         },
//         events: {
//           onReady: onPlayerReady,
//           onStateChange: onPlayerStateChange,
//           onError: onPlayerError
//         }
//       });
//     } catch (err) {
//       console.error("Error initializing YouTube player:", err);
//       setError(`Failed to initialize player: ${err.message}`);
//     }
//   };

//   // Extract video ID from YouTube URL
//   const extractVideoId = (url) => {
//     if (!url) return '';
//     const match = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/);
//     return match ? match[1] : '';
//   };

//   // Player event handlers
//   const onPlayerReady = (event) => {
//     if (isPlaying) {
//       event.target.playVideo();
//     }
//   };

//   const onPlayerStateChange = (event) => {
//     // YT.PlayerState values:
//     // -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
//     const playerState = event.data;
//     console.log(`Player state changed to ${playerState}`);
    
//     // Handle track ending
//     if (playerState === 0) {
//       // Use functional update to ensure we're using the latest state
//       setCurrentTrack(prevTrack => {
//         const nextIndex = (prevTrack + 1) % playlist.length;
//         console.log(`Song ended. Moving from track index ${prevTrack} to ${nextIndex}`);
        
//         // Load the next video with the correct index
//         setTimeout(() => {
//           if (playerRef.current) {
//             const videoId = extractVideoId(playlist[nextIndex].song_url);
//             if (videoId) {
//               playerRef.current.loadVideoById(videoId);
//             }
//           }
//         }, 50);
        
//         return nextIndex;
//       });
//     }
    
//     // Update playing state based on player state
//     const isNowPlaying = playerState === 1; // YT.PlayerState.PLAYING = 1
//     setIsPlaying(isNowPlaying);
    
//     // Start or stop progress tracking based on play state
//     if (isNowPlaying) {
//       startProgressTracking();
//     } else {
//       stopProgressTracking();
//     }
//   };
  
//   // Start tracking progress
//   const startProgressTracking = () => {
//     if (progressIntervalRef.current) {
//       clearInterval(progressIntervalRef.current);
//     }
    
//     progressIntervalRef.current = setInterval(() => {
//       if (playerRef.current) {
//         const currentTime = playerRef.current.getCurrentTime() || 0;
//         const totalDuration = playerRef.current.getDuration() || 0;
//         const progressPercent = (currentTime / totalDuration) * 100 || 0;
        
//         setProgress(progressPercent);
//         setCurrentTime(currentTime);
//         setDuration(totalDuration);
//       }
//     }, 1000);
//   };
  
//   // Stop tracking progress
//   const stopProgressTracking = () => {
//     if (progressIntervalRef.current) {
//       clearInterval(progressIntervalRef.current);
//       progressIntervalRef.current = null;
//     }
//   };

//   const onPlayerError = (event) => {
//     console.error("YouTube player error:", event.data);
//     setError(`Player error: ${getPlayerErrorMessage(event.data)}`);
//   };

//   // Get error message based on YouTube error code
//   const getPlayerErrorMessage = (errorCode) => {
//     switch(errorCode) {
//       case 2: return "Invalid video ID";
//       case 5: return "HTML5 player error";
//       case 100: return "Video not found or removed";
//       case 101: 
//       case 150: return "Video cannot be played in embedded players";
//       default: return `Unknown error (code: ${errorCode})`;
//     }
//   };

//   // Player controls
//   const togglePlay = () => {
//     if (!playerRef.current) return;
    
//     if (isPlaying) {
//       playerRef.current.pauseVideo();
//     } else {
//       playerRef.current.playVideo();
//     }
//   };

//   const playNext = () => {
//     if (playlist.length === 0) return;
//     const nextIndex = (currentTrack + 1) % playlist.length;
//     setCurrentTrack(nextIndex);
//     loadVideo(nextIndex);
//   };

//   const playPrevious = () => {
//     if (playlist.length === 0) return;
//     const prevIndex = (currentTrack - 1 + playlist.length) % playlist.length;
//     setCurrentTrack(prevIndex);
//     loadVideo(prevIndex);
//   };

//   const loadVideo = (index) => {
//     if (!playerRef.current || !playlist[index]) return;
    
//     console.log(`Loading video at index ${index}:`, playlist[index].title);
//     setCurrentTrack(index); // Ensure state is updated to match the loaded video
    
//     const videoId = extractVideoId(playlist[index].song_url);
//     if (!videoId) {
//       setError("Invalid video URL");
//       return;
//     }
    
//     playerRef.current.loadVideoById(videoId);
//     setIsPlaying(true);
//   };

//   const playSpecificTrack = (index) => {
//     console.log(`Playing specific track at index ${index}:`, playlist[index].title);
//     setCurrentTrack(index);
//     loadVideo(index);
//   };

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
  
//   // Format time (seconds to MM:SS)
//   const formatTime = (timeInSeconds) => {
//     if (!timeInSeconds || isNaN(timeInSeconds)) return "0:00";
//     const minutes = Math.floor(timeInSeconds / 60);
//     const seconds = Math.floor(timeInSeconds % 60);
//     return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
//   };
  
//   // Handle progress bar change
//   const handleProgressChange = (e) => {
//     if (!playerRef.current) return;
    
//     const newProgress = parseFloat(e.target.value);
//     setProgress(newProgress);
    
//     // Calculate time based on percentage
//     const seekTime = (newProgress / 100) * duration;
//     playerRef.current.seekTo(seekTime, true);
//   };

//   // Render loading state
//   if (loading) {
//     return (
//       <div className="play-room loading">
//         <div className="loader"></div>
//         <p>Loading playlist...</p>
//       </div>
//     );
//   }

//   // Render error state
//   if (error) {
//     return (
//       <div className="play-room error">
//         <h2>Something went wrong</h2>
//         <p>{error}</p>
//         <button onClick={() => navigate('/homepage')} className="back-button">Go Back</button>
//       </div>
//     );
//   }

//   // Get current track info
//   const currentSong = playlist[currentTrack] || {};

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
      
//       <div className="player-grid">
//         <div className="player-container">
//           <div className="album-art">
//             {currentSong.cover_img_url ? (
//               <img 
//                 src={currentSong.cover_img_url} 
//                 alt={`${currentSong.title} cover`} 
//                 onError={(e) => {
//                   e.target.onerror = null;
//                   e.target.src = 'https://i.scdn.co/image/ab67616d0000b2730b66bb2555bb1d5a0d0c42d7';
//                 }}
//               />
//             ) : (
//               <div className="placeholder-art">
//                 <span>♪</span>
//               </div>
//             )}
//           </div>
          
//           <div className="song-info">
//             <h2>{currentSong.title}</h2>
//             <p>{currentSong.artist}</p>
//           </div>
          
//           <div className="progress-container">
//             <span className="time-elapsed">
//               {formatTime(currentTime)}
//             </span>
//             <input
//               type="range"
//               min="0"
//               max="100"
//               value={progress}
//               onChange={handleProgressChange}
//               className="progress-bar"
//             />
//             <span className="time-total">
//               {formatTime(duration)}
//             </span>
//           </div>
          
//           <div className="controls">
//             <button onClick={playPrevious} className="control-button previous">
//               ⏮
//             </button>
//             <button onClick={togglePlay} className="control-button play-pause">
//               {isPlaying ? "⏸" : "▶"}
//             </button>
//             <button onClick={playNext} className="control-button next">
//               ⏭
//             </button>
//           </div>

//           {/* Hidden container for YouTube API player */}
//           <div ref={playerContainerRef} id="youtube-player" style={{ display: 'none' }}></div>
//         </div>

//         <div className="playlist-section">
//           <div className="playlist-header">
//             <h3>Playlist ({playlist.length} songs)</h3>
//             <button onClick={handleSearchMusic} className="search-music-button">
//               Add Music
//             </button>
//           </div>
//           <ul className="track-list">
//             {playlist.map((track, index) => (
//               <li 
//                 key={index}
//                 className={index === currentTrack ? 'active' : ''}
//                 onClick={() => playSpecificTrack(index)}
//               >
//                 {track.cover_img_url && (
//                   <img 
//                     src={track.cover_img_url} 
//                     alt=""
//                     className="track-thumbnail"
//                     onError={(e) => {
//                       e.target.onerror = null;
//                       e.target.style.display = 'none';
//                     }}
//                   />
//                 )}
//                 <span className="track-number">{index + 1}</span>
//                 <div className="track-details">
//                   <span className="track-title">{track.title}</span>
//                   <span className="track-artist">{track.artist}</span>
//                 </div>
//                 {index === currentTrack && (
//                   <span className="now-playing">▶</span>
//                 )}
//               </li>
//             ))}
//           </ul>
//         </div>
//       </div>

//       <section className="playlist-info">
//         <h2>Playlist Information</h2>
//         <p>{introduction}</p>
//         {settings && (
//           <div className="playlist-settings">
//             <h3>Playlist Settings</h3>
//             <p><strong>Prompt:</strong> {settings.prompt}</p>
//             <p><strong>Genre:</strong> {settings.genre}</p>
//             <p><strong>Occasion:</strong> {settings.occasion}</p>
//           </div>
//         )}
//       </section>

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
