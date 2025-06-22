// PlayRoom.js with socket integration
import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Hooks and Components
import { usePlaylist, useYouTubePlayer, useNotifications } from '../hooks';
import useSocketConnection from '../hooks/useSocketConnection'; // Import the new hook
import { 
  RoomHeader, 
  PlayerControls, 
  PlaylistSection, 
  PendingRequestsSection, 
  PlaylistInfoSection, 
  QRCodeModal,
  LyricsSection,
  PinPriceSettings,
  AIModerationSettings
} from './playroom-components';
import RequestNotificationModal from './RequestNotificationModal';
import { ToggleLeft, ToggleRight, Edit, RefreshCw, PlusCircle, Sparkles } from 'lucide-react';

import '../styles/PlayRoom.css';
import { API_URL } from '../config';

// Mobile Wrapper Component
const MobileResponsiveWrapper = ({ children }) => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    // Check if screen is mobile size
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    // Initial check
    checkMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkMobile);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);
  
  return (
    <div className={`content-wrapper ${isMobile ? 'mobile-view' : ''}`}>
      {children}
    </div>
  );
};

function PlayRoom() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const roomName = queryParams.get('room_name');
  const isHostParam = queryParams.get('is_host') === 'True';
  const initialModeration = queryParams.get('moderation') === 'True';
  const [showQRCode, setShowQRCode] = useState(false);
  const [showLyrics, setShowLyrics] = useState(true);
  const [isHost, setIsHost] = useState(isHostParam);
  const [moderationEnabled, setModerationEnabled] = useState(initialModeration);
  const [isMobile, setIsMobile] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [infoEditing, setInfoEditing] = useState({
    introduction: ''
  });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingPlaylist, setRefreshingPlaylist] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [showConnectionError, setShowConnectionError] = useState(false);
  const [playerError, setPlayerError] = useState(null);
  
  // AI moderation state
  const [showAiModerationSettings, setShowAiModerationSettings] = useState(false);
  const [aiModerationEnabled, setAiModerationEnabled] = useState(false);
  const [aiModerationDescription, setAiModerationDescription] = useState('');
  const [aiModerationStrictness, setAiModerationStrictness] = useState('medium');
  const [loadingAiSettings, setLoadingAiSettings] = useState(false);
  
  // Add a ref to preserve current line index when toggling lyrics
  const currentLineIndexRef = useRef(-1);
  
  const SONGS_PER_PAGE = 10;
  
  // Check screen size for responsive layout
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    // Initial check
    checkMobile();
    
    // Add listener for resize
    window.addEventListener('resize', checkMobile);
    
    // Clean up
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Check if we have a valid room name
  useEffect(() => {
    if (!roomName) {
      navigate('/');
      return;
    }

    // Get current user data
    const userDataStr = localStorage.getItem('user');
    const userData = userDataStr ? JSON.parse(userDataStr) : null;
    const token = localStorage.getItem('token');

    // Verify host status with backend
    const verifyHostStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/api/room/host?room_name=${encodeURIComponent(roomName)}`, {
          headers: {
            'Authorization': token
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to verify host status');
        }
        
        const data = await response.json();
        
        // Handle rooms without registered host
        if (data.allow_anyone_host) {
          setIsHost(true);
          // Update URL to reflect host status
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('is_host', 'True');
          navigate(newUrl.pathname + newUrl.search, { replace: true });
          return;
        }
        
        // For rooms with registered host, verify username
        const actualIsHost = userData && data.host_username === userData.username;
        setIsHost(actualIsHost);
        
        // If URL claims host but verification fails, redirect to non-host URL
        if (isHostParam && !actualIsHost) {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('is_host', 'False');
          navigate(newUrl.pathname + newUrl.search, { replace: true });
        }
      } catch (error) {
        console.error('Error verifying host status:', error);
        setIsHost(false);
      }
    };

    // Fetch room settings to get actual moderation status
    const fetchRoomSettings = async () => {
      try {
        // First get room playlist which includes basic settings
        const playlistResponse = await fetch(`${API_URL}/api/room-playlist?room_name=${encodeURIComponent(roomName)}`);
        
        if (!playlistResponse.ok) {
          throw new Error('Failed to fetch room settings');
        }
        
        const playlistData = await playlistResponse.json();
        
        // Get actual moderation status from settings
        const actualModerationEnabled = playlistData.settings?.moderation_enabled !== undefined 
          ? playlistData.settings.moderation_enabled 
          : true; // Default to true if not specified
        
        console.log(`Actual moderation status from server: ${actualModerationEnabled}`);
        
        // Update state with actual moderation status
        setModerationEnabled(actualModerationEnabled);
        
        // Now fetch AI moderation settings to get AI moderation status
        const aiSettingsResponse = await fetch(`${API_URL}/api/get-room-ai-moderation?room_name=${encodeURIComponent(roomName)}`);
        
        if (aiSettingsResponse.ok) {
          const aiData = await aiSettingsResponse.json();
          const aiEnabled = aiData.settings?.enabled || false;
          
          console.log(`AI moderation status from server: ${aiEnabled}`);
          setAiModerationEnabled(aiEnabled);
          
          // If AI settings exist, store them
          if (aiData.settings) {
            setAiModerationDescription(aiData.settings.description || '');
            setAiModerationStrictness(aiData.settings.strictness_level || 'medium');
          }
        }
        
        // Update URL to reflect actual moderation status if different
        if (initialModeration !== actualModerationEnabled) {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('moderation', actualModerationEnabled ? 'True' : 'False');
          navigate(newUrl.pathname + newUrl.search, { replace: true });
        }
      } catch (error) {
        console.error('Error fetching room settings:', error);
      }
    };

    verifyHostStatus();
    fetchRoomSettings();
  }, [roomName, navigate, isHostParam, initialModeration]);

  // Get playlist data and management functions
  const { 
    playlist, 
    setPlaylist, 
    pendingRequests, 
    fetchPendingRequests, 
    introduction, 
    settings, 
    hostData, 
    loading, 
    error, 
    handleTrackDelete, 
    handleApproveRequest, 
    handleRejectRequest, 
    updateRoomModeration,
    updatePlaylistInfo,
    handlePinToTop,
    fetchAiModerationSettings,
    updateAiModerationSettings,
    fetchAiModerationHints,
    fetchAiModerationHistory
  } = usePlaylist(roomName, isHost);

  // Initialize socket connection
  const { 
    socket, 
    connectionError, 
    isConnected,
    emitPlayerState 
  } = useSocketConnection(roomName, isHost);

  // Set connected users from socket data
  useEffect(() => {
    if (connectionError) {
      setShowConnectionError(true);
    }
  }, [connectionError]);

  // Set initial moderation state based on settings
  useEffect(() => {
    if (settings && settings.moderation_enabled !== undefined) {
      console.log(`Setting moderation from settings: ${settings.moderation_enabled}`);
      
      // Update moderation state
      setModerationEnabled(settings.moderation_enabled);
      
      // Update URL to reflect actual moderation status
      const params = new URLSearchParams(location.search);
      const currentModeration = params.get('moderation') === 'True';
      
      if (currentModeration !== settings.moderation_enabled) {
        params.set('moderation', settings.moderation_enabled ? 'True' : 'False');
        navigate(`${location.pathname}?${params.toString()}`, { replace: true });
      }
    }
  }, [settings, location.search, location.pathname, navigate]);

  // Set initial editing state when introduction loads
  useEffect(() => {
    if (introduction) {
      setInfoEditing({ introduction });
    }
  }, [introduction]);

  // Use our modified YouTube player hook with socket integration
  const {
    currentTrack,
    isPlaying,
    progress,
    duration,
    currentTime,
    playerContainerRef,
    togglePlay,
    playNext,
    playPrevious,
    formatTime,
    handleProgressChange,
    playSpecificTrack,
    handlePinToTop: handlePinToTopPlayer,
    stopProgressTracking,
    isHost: playerIsHost, // This should match the isHost state
    playerError: youtubePlayerError, // Renamed to avoid conflict
    syncWithHost, // New function to sync with host
    syncedWithHost // New state to track sync status
  } = useYouTubePlayer(playlist, socket, isHost, emitPlayerState);
  
  // Update the local playerError state when the YouTube player error changes
  useEffect(() => {
    if (youtubePlayerError) {
      setPlayerError(youtubePlayerError);
    }
  }, [youtubePlayerError]);

  const {
    showNotification,
    setShowNotification,
    notificationMessage,
    notificationTitle,
    notificationType,
    showNotificationMessage
  } = useNotifications(roomName, isHost);

  // Handle toggling lyrics visibility with better state preservation
  const handleToggleLyrics = () => {
    // Use a callback to ensure proper state update
    setShowLyrics(prev => !prev);
  };

  // Set up polling for pending requests - improved version
  useEffect(() => {
    if (!roomName) return;
    
    console.log(`Setting up polling for room ${roomName}, isHost: ${isHost}`);
    
    // Fetch immediately when component mounts
    if (isHost) {
      fetchPendingRequests();
    }
    
    const pollInterval = setInterval(() => {
      if (isHost) {
        console.log("Polling for pending requests...");
        fetchPendingRequests();
      }
    }, 30000); // Poll every 30 seconds
    
    return () => {
      console.log("Cleaning up polling interval");
      clearInterval(pollInterval);
    };
  }, [roomName, fetchPendingRequests, isHost]);

  // Manual fetch function for pending requests
  const manualFetchPendingRequests = async () => {
    if (!isHost) return;
    
    setRefreshing(true);
    console.log(`Manually fetching pending requests for room ${roomName}`);
    
    try {
      await fetchPendingRequests();
    } finally {
      // Add a slight delay so the spinner is visible
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  // Function to refresh the playlist without interrupting playback
  const refreshPlaylist = async () => {
    if (!roomName) return;
    
    setRefreshingPlaylist(true);
    console.log(`Refreshing playlist for room ${roomName}`);
    
    try {
      // Get the current track info before refreshing
      const currentSongId = playlist[currentTrack]?.song_id;
      const currentPosition = currentTime;
      const wasPlaying = isPlaying;
      
      // Fetch the latest playlist from the backend
      const response = await fetch(`${API_URL}/api/room-playlist?room_name=${encodeURIComponent(roomName)}`);
      
      if (!response.ok) {
        throw new Error('Failed to refresh playlist');
      }
      
      const data = await response.json();
      
      // Update the playlist state
      setPlaylist(data.playlist);
      
      // Find the current track in the new playlist
      if (currentSongId) {
        const newIndex = data.playlist.findIndex(track => track.song_id === currentSongId);
        
        // If the current track still exists in the new playlist, update the player
        if (newIndex !== -1 && newIndex !== currentTrack) {
          // Update the current track index without interrupting playback
          // This is handled by the useYouTubePlayer hook
          console.log(`Current track found at new index: ${newIndex}`);
        }
      }
      
      showNotificationMessage('Playlist Refreshed', 'Playlist has been updated', 'success');
    } catch (error) {
      console.error('Error refreshing playlist:', error);
      showNotificationMessage('Error', 'Failed to refresh playlist', 'error');
    } finally {
      // Add a slight delay so the spinner is visible
      setTimeout(() => setRefreshingPlaylist(false), 500);
    }
  };

  // Handle pin to top action (requires updating playlist state)
  const handlePinTrack = async (selectedIndex, currentPlayingIndex, isGuestPin = false) => {
    // If user is host, pin directly
    if (isHost) {
      // Convert page-relative index to absolute index in the full playlist
      const actualIndex = (currentPage - 1) * SONGS_PER_PAGE + selectedIndex;
      
      // Pass the actual index to the backend
      const newPlaylist = await handlePinToTop(actualIndex, currentPlayingIndex);
      if (newPlaylist) {
        setPlaylist(newPlaylist);
        showNotificationMessage('Track Pinned', 'Track will play after the current song', 'success');
      }
      return;
    }
    
    // For guests, use the coin-based pinning
    if (isGuestPin) {
      // Convert page-relative index to absolute index in the full playlist
      const actualIndex = (currentPage - 1) * SONGS_PER_PAGE + selectedIndex;
      
      // Pass the actual index to the backend with guest flag
      const newPlaylist = await handlePinToTop(actualIndex, currentPlayingIndex, true);
      if (newPlaylist) {
        setPlaylist(newPlaylist);
        showNotificationMessage('Track Pinned', 'Track will play after the current song', 'success');
      }
    }
  };

  // Handle navigation to search music page
  const handleSearchMusic = () => {
    navigate(`/search_music?room=${roomName}&is_host=${isHost ? 'True' : 'False'}`);
  };
  
  // Handle navigation to playlist generator page
  const handleGeneratePlaylist = () => {
    navigate(`/playlist?room_name=${encodeURIComponent(roomName)}&moderation=${moderationEnabled ? 'yes' : 'no'}&append=True&is_host=${isHost ? 'True' : 'False'}`);
  };

  // Handle moderation change (three-state toggle: off, on, ai)
  const handleModerationChange = async (newState) => {
    // Only allow host to change moderation settings
    if (!isHost) return;
    
    // Prevent duplicate state changes
    if ((newState === 'off' && !moderationEnabled) || 
        (newState === 'on' && moderationEnabled && !aiModerationEnabled) ||
        (newState === 'ai' && moderationEnabled && aiModerationEnabled)) {
      return; // No change needed
    }
    
    // newState can be: 'off', 'on', 'ai'
    const newModerationEnabled = newState !== 'off';
    
    try {
      // Update UI state first for immediate feedback
      setModerationEnabled(newModerationEnabled);
      
      // Update URL parameter
      const params = new URLSearchParams(location.search);
      params.set('moderation', newModerationEnabled ? 'True' : 'False');
      navigate(`${location.pathname}?${params.toString()}`, { replace: true });
      
      // Update backend setting
      if (updateRoomModeration) {
        await updateRoomModeration(roomName, newModerationEnabled);
        
        // If switching to AI moderation
        if (newState === 'ai') {
          // Set AI moderation enabled first
          setAiModerationEnabled(true);
          
          // Update backend with a single call - only if we're changing to AI mode
          await updateAiModerationSettings(roomName, true, aiModerationDescription, aiModerationStrictness);
          
          // Open AI moderation settings modal after backend is updated
          setShowAiModerationSettings(true);
        } else {
          // If AI moderation was enabled but now we're turning it off
          if (aiModerationEnabled && newState !== 'ai') {
            setAiModerationEnabled(false);
            await updateAiModerationSettings(roomName, false, aiModerationDescription, aiModerationStrictness);
          }
        }
        
        showNotificationMessage(
          'Moderation Setting Updated', 
          newState === 'off' 
            ? 'Song requests will be added directly to the playlist' 
            : newState === 'on'
              ? 'Song requests will now require manual approval'
              : 'Song requests will be automatically moderated by AI',
          'success'
        );
      }
    } catch (err) {
      console.error('Failed to update moderation setting:', err);
      // Revert UI state if backend update fails
      setModerationEnabled(moderationEnabled);
      setAiModerationEnabled(aiModerationEnabled);
      showNotificationMessage(
        'Error', 
        'Failed to update moderation setting',
        'error'
      );
    }
  };
  
  // Legacy toggle moderation function for compatibility
  const toggleModeration = () => {
    handleModerationChange(moderationEnabled ? 'off' : 'on');
  };
  
  // Toggle AI moderation settings modal
  const toggleAiModerationSettings = () => {
    // Only allow host to change AI moderation settings
    if (!isHost || !moderationEnabled) return;
    
    setShowAiModerationSettings(!showAiModerationSettings);
  };
  
  // Handle AI moderation settings update
  const handleAiModerationUpdate = async (settings) => {
    setAiModerationEnabled(settings.enabled);
    setAiModerationDescription(settings.description);
    setAiModerationStrictness(settings.strictnessLevel);
    
    setShowAiModerationSettings(false);
    
    showNotificationMessage(
      'AI Moderation Updated',
      settings.enabled 
        ? 'AI will now automatically moderate song requests based on your criteria' 
        : 'AI moderation has been disabled',
      'success'
    );
  };

  // Pagination handlers
  const totalPages = Math.ceil(playlist.length / SONGS_PER_PAGE);
  
  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };
  
  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };
  
  // Get current page of songs
  const getCurrentPageSongs = () => {
    const startIndex = (currentPage - 1) * SONGS_PER_PAGE;
    return playlist.slice(startIndex, startIndex + SONGS_PER_PAGE);
  };

  // Calculate the current track index relative to the current page
  const getPageRelativeCurrentTrack = () => {
    if (currentTrack < 0 || !playlist[currentTrack]) return -1;
    
    const startIndex = (currentPage - 1) * SONGS_PER_PAGE;
    const endIndex = startIndex + SONGS_PER_PAGE - 1;
    
    // If current track is not on this page, return -1
    if (currentTrack < startIndex || currentTrack > endIndex) {
      return -1;
    }
    
    // Return the page-relative index
    return currentTrack - startIndex;
  };

  // Fix for track selection - map index back to full playlist index
  const handlePlaySpecificTrack = (index) => {
    // Only allow host to select tracks
    if (!isHost) return;
    
    const actualIndex = (currentPage - 1) * SONGS_PER_PAGE + index;
    playSpecificTrack(actualIndex);
  };

  // Edit playlist info handlers
  const handleEditInfo = () => {
    // Only allow host to edit
    if (!isHost) return;
    
    setShowEditInfo(true);
  };
  
  const handleSaveInfo = async () => {
    // Only allow host to save changes
    if (!isHost) return;
    
    try {
      if (updatePlaylistInfo) {
        await updatePlaylistInfo(roomName, infoEditing.introduction);
        showNotificationMessage('Success', 'Playlist information updated', 'success');
      }
      setShowEditInfo(false);
    } catch (err) {
      console.error('Failed to update playlist info:', err);
      showNotificationMessage('Error', 'Failed to update playlist information', 'error');
    }
  };
  
  const handleInfoChange = (e) => {
    const { name, value } = e.target;
    setInfoEditing(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Save current line index when updating so it can be restored
  const handleSaveCurrentLineIndex = (lineIndex) => {
    currentLineIndexRef.current = lineIndex;
  };

  // Display appropriate messages when there are errors or loading
  if (loading) {
    return (
      <div className="play-room loading">
        <div className="loader"></div>
        <p>Loading playlist...</p>
      </div>
    );
  }

  // We'll handle errors inline instead of replacing the entire component

  const currentSong = playlist[currentTrack] || {};

  return (
    <MobileResponsiveWrapper>
      <div className={`play-room ${isMobile ? 'mobile-view' : ''}`}>
        {/* Room Header */}
        <RoomHeader 
          roomName={roomName}
          hostData={hostData}
          showQRCode={showQRCode}
          setShowQRCode={setShowQRCode}
          roomInfo={settings}
        />
        

        
        {/* Show connected users for host */}
        {isHost && connectedUsers.length > 0 && (
          <div className="connected-users">
            <h4>Connected Users: {connectedUsers.length}</h4>
            <ul>
              {connectedUsers.map((user, index) => (
                <li key={index}>{user.username} {user.is_host ? '(Host)' : ''}</li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="main-content">
          <div className="player-playlist-grid">
            {/* Left Column: Player and Moderation */}
            <div className="left-column">
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
                      <div>No track selected</div>
                    </div>
                  )}
                </div>
                
                <PlayerControls
                  currentSong={currentSong}
                  isPlaying={isPlaying}
                  progress={progress}
                  duration={duration}
                  currentTime={currentTime}
                  formatTime={formatTime}
                  handleProgressChange={handleProgressChange}
                  togglePlay={togglePlay}
                  playNext={playNext}
                  playPrevious={playPrevious}
                  showLyrics={showLyrics}
                  onToggleLyrics={handleToggleLyrics}
                  isHost={isHost} // Pass isHost to control component
                  syncWithHost={syncWithHost} // Pass syncWithHost function
                />
                
                {/* Integrated lyrics section within player */}
                {showLyrics && (
                  <div className="integrated-lyrics">
                    <LyricsSection 
                      currentSong={currentSong}
                      isVisible={showLyrics}
                      currentTime={currentTime}
                      preventPageScroll={true}
                      onCurrentLineChange={handleSaveCurrentLineIndex}
                      initialLineIndex={currentLineIndexRef.current}
                    />
                  </div>
                )}
                
                <div ref={playerContainerRef} id="youtube-player" style={{ display: 'none' }}></div>
              </div>
              
              {/* Moderation Section - controls for host, status for guests */}
              <div className="moderation-section">
                <div className="moderation-controls">
                  <h3>Moderation</h3>
                  
                  {isHost ? (
                    /* Three-state Moderation Toggle - only for hosts */
                    <>
                      <div className="moderation-toggle-group">
                        <button 
                          className={`moderation-toggle-option ${!moderationEnabled ? 'active' : ''}`}
                          onClick={() => handleModerationChange('off')}
                          title="Moderation Off"
                        >
                          <ToggleLeft size={isMobile ? 16 : 20} /> 
                          <span>Off</span>
                        </button>
                        
                        <button 
                          className={`moderation-toggle-option ${moderationEnabled && !aiModerationEnabled ? 'active' : ''}`}
                          onClick={() => handleModerationChange('on')}
                          title="Manual Moderation"
                        >
                          <ToggleRight size={isMobile ? 16 : 20} /> 
                          <span>Manual</span>
                        </button>
                        
                        <button 
                          className={`moderation-toggle-option ${aiModerationEnabled ? 'active' : ''}`}
                          onClick={() => handleModerationChange('ai')}
                          title="AI Moderation"
                        >
                          <Sparkles size={isMobile ? 14 : 16} />
                          <span>AI</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    /* Moderation Status Display - for guests */
                    <div className="moderation-status-display">
                      <div className="moderation-status-indicator">
                        <span className="moderation-status-label">Status:</span>
                        {!moderationEnabled ? (
                          <span className="moderation-status-value off">
                            <ToggleLeft size={16} /> Off
                          </span>
                        ) : aiModerationEnabled ? (
                          <span className="moderation-status-value ai">
                            <Sparkles size={14} /> AI Moderation
                          </span>
                        ) : (
                          <span className="moderation-status-value on">
                            <ToggleRight size={16} /> Manual Moderation
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* AI Settings button - only shown when AI moderation is enabled */}
                  {isHost && aiModerationEnabled && (
                    <button 
                      className="ai-settings-button"
                      onClick={toggleAiModerationSettings}
                      title="Configure AI Moderation Settings"
                    >
                      <Edit size={isMobile ? 14 : 16} />
                      <span>AI Settings</span>
                    </button>
                  )}
                  
                  {/* Refresh button for pending requests - only visible to host */}
                  {isHost && (
                    <button 
                      onClick={manualFetchPendingRequests}
                      className="refresh-button"
                      disabled={refreshing}
                      title="Refresh pending requests"
                    >
                      <RefreshCw size={isMobile ? 16 : 18} className={refreshing ? 'spinning' : ''} />
                    </button>
                  )}
                </div>
                
                {/* Pending Requests Section - only visible to host */}
                {isHost && (
                  <PendingRequestsSection
                    pendingRequests={pendingRequests}
                    roomName={roomName}
                    onApprove={handleApproveRequest}
                    onReject={handleRejectRequest}
                  />
                )}
              </div>
            </div>
            
            {/* Right Column: Playlist with Pagination */}
            <div className="right-column">
              <div className="playlist-container">
                <PlaylistSection
                  playlist={getCurrentPageSongs()}
                  fullPlaylistLength={playlist.length}
                  isHost={isHost}
                  currentTrack={getPageRelativeCurrentTrack()}
                  roomName={roomName}
                  onTrackClick={handlePlaySpecificTrack}
                  onTrackDelete={handleTrackDelete}
                  onPinToTop={handlePinTrack}
                  stopProgressTracking={stopProgressTracking}
                  onAddMusicClick={handleSearchMusic}
                  onGeneratePlaylistClick={handleGeneratePlaylist}
                  onRefreshPlaylist={refreshPlaylist}
                  isRefreshing={refreshingPlaylist}
                />
                
                {/* Pin Price Settings (Host Only) */}
                {isHost && (
                  <PinPriceSettings 
                    roomName={roomName}
                    isHost={isHost}
                  />
                )}
                
                {/* Pagination Controls */}
                {playlist.length > SONGS_PER_PAGE && (
                  <div className="pagination-controls">
                    <button 
                      className="pagination-button" 
                      onClick={handlePrevPage}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </button>
                    <span className="pagination-info">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button 
                      className="pagination-button" 
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Playlist Info with Edit Option */}
        <div className="playlist-info-container">
          <div className="playlist-info-header">
            <h2>About This Playlist</h2>
            {isHost && (
              <button 
                className="edit-info-button"
                onClick={handleEditInfo}
                title="Edit playlist information"
              >
                <Edit size={16} />
                Edit
              </button>
            )}
          </div>
          
          {showEditInfo ? (
            <div className="playlist-info-edit">
              <textarea
                name="introduction"
                value={infoEditing.introduction}
                onChange={handleInfoChange}
                className="info-edit-textarea"
                placeholder="Enter playlist description..."
                rows={4}
              ></textarea>
              <div className="edit-buttons">
                <button 
                  className="cancel-edit-button"
                  onClick={() => {
                    setInfoEditing({ introduction });
                    setShowEditInfo(false);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="save-edit-button"
                  onClick={handleSaveInfo}
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="playlist-info-content">
              <div className="playlist-description">{introduction}</div>
              
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
          )}
        </div>

        {/* QR Code Modal */}
        {showQRCode && (
          <QRCodeModal 
            show={showQRCode}
            roomName={roomName} 
            onClose={() => setShowQRCode(false)} 
          />
        )}
        
        {/* Notification Modal */}
        {showNotification && (
          <RequestNotificationModal
            title={notificationTitle}
            message={notificationMessage}
            type={notificationType}
            onClose={() => setShowNotification(false)}
          />
        )}
        
        {/* Connection Error Banner */}
        {showConnectionError && (
          <div className="player-error-banner">
            <div className="error-content">
              <span className="error-icon">⚠️</span>
              <span>{connectionError || 'There was an error connecting to the room. Please try again later.'}</span>
              <button
                className="close-error"
                onClick={() => setShowConnectionError(false)}
              >
                ×
              </button>
            </div>
          </div>
        )}
        
        {/* Player Error Message */}
        {(playerError || error) && (
          <div className="player-error-banner">
            <div className="error-content">
              <span className="error-icon">⚠️</span>
              <span>{playerError || error}</span>
              <button onClick={() => {
                setPlayerError(null);
                if (error) window.location.reload();
              }} className="close-error">×</button>
            </div>
          </div>
        )}
        
        {/* AI Moderation Settings Modal */}
        {showAiModerationSettings && (
          <div className="ai-moderation-settings-overlay">
            <AIModerationSettings
              roomName={roomName}
              isHost={isHost}
              moderationEnabled={moderationEnabled}
              fetchAiModerationSettings={fetchAiModerationSettings}
              updateAiModerationSettings={updateAiModerationSettings}
              fetchAiModerationHints={fetchAiModerationHints}
              onAiModerationUpdate={handleAiModerationUpdate}
              onClose={toggleAiModerationSettings}
            />
          </div>
        )}
      </div>
    </MobileResponsiveWrapper>
  );
}

export default PlayRoom;