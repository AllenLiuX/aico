// PlayRoom.js with all fixes implemented
import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Hooks and Components
import { usePlaylist, useYouTubePlayer, useNotifications } from '../hooks';
import { 
  RoomHeader, 
  PlayerControls, 
  PlaylistSection, 
  PendingRequestsSection, 
  PlaylistInfoSection, 
  QRCodeModal,
  LyricsSection
} from './playroom-components';
import RequestNotificationModal from './RequestNotificationModal';
import { ToggleLeft, ToggleRight, Edit, RefreshCw } from 'lucide-react';

import '../styles/PlayRoom.css';

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
      navigate('/homepage');
    }
    setIsHost(isHostParam);
  }, [roomName, navigate, isHostParam]);

  // Use our custom hooks
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
    updatePlaylistInfo
  } = usePlaylist(roomName, isHost);

  // Set initial moderation state based on settings
  useEffect(() => {
    if (settings && settings.moderation_enabled !== undefined) {
      console.log(`Setting moderation from settings: ${settings.moderation_enabled}`);
      setModerationEnabled(settings.moderation_enabled);
    }
  }, [settings]);

  // Set initial editing state when introduction loads
  useEffect(() => {
    if (introduction) {
      setInfoEditing({ introduction });
    }
  }, [introduction]);

  const {
    currentTrack,
    isPlaying,
    progress,
    duration,
    currentTime,
    playerError,
    playerContainerRef,
    togglePlay,
    playNext,
    playPrevious,
    formatTime,
    handleProgressChange,
    playSpecificTrack,
    handlePinToTop,
    stopProgressTracking
  } = useYouTubePlayer(playlist);

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
    fetchPendingRequests();
    
    const pollInterval = setInterval(() => {
      console.log("Polling for pending requests...");
      fetchPendingRequests();
    }, 30000); // Poll every 5 seconds
    
    return () => {
      console.log("Cleaning up polling interval");
      clearInterval(pollInterval);
    };
  }, [roomName, fetchPendingRequests]); // Removed isHost dependency

  // Manual fetch function for pending requests
  const manualFetchPendingRequests = async () => {
    setRefreshing(true);
    console.log(`Manually fetching pending requests for room ${roomName}`);
    
    try {
      await fetchPendingRequests();
    } finally {
      // Add a slight delay so the spinner is visible
      setTimeout(() => setRefreshing(false), 5000);
    }
  };

  // Handle pin to top action (requires updating playlist state)
  const handlePinTrack = (selectedIndex, currentPlayingIndex) => {
    // Convert page-relative index to absolute index in the full playlist
    const actualIndex = (currentPage - 1) * SONGS_PER_PAGE + selectedIndex;
    
    // Use the actual index with the pin function
    const newPlaylist = handlePinToTop(actualIndex, currentPlayingIndex);
    if (newPlaylist) {
      setPlaylist(newPlaylist);
      showNotificationMessage('Track Pinned', 'Track will play after the current song', 'success');
    }
  };

  // Handle navigation to search music page
  const handleSearchMusic = () => {
    navigate(`/search_music?room=${roomName}&is_host=${isHost ? 'True' : 'False'}`);
  };

  // Toggle moderation setting
  const toggleModeration = async () => {
    const newModerationState = !moderationEnabled;
    
    try {
      // Update UI state first for immediate feedback
      setModerationEnabled(newModerationState);
      
      // Update URL parameter
      const params = new URLSearchParams(location.search);
      params.set('moderation', newModerationState ? 'True' : 'False');
      navigate(`${location.pathname}?${params.toString()}`, { replace: true });
      
      // Update backend setting
      if (updateRoomModeration) {
        await updateRoomModeration(roomName, newModerationState);
        showNotificationMessage(
          'Moderation Setting Updated', 
          newModerationState 
            ? 'Song requests will now require approval' 
            : 'Song requests will be added directly to the playlist',
          'success'
        );
      }
    } catch (err) {
      console.error('Failed to update moderation setting:', err);
      // Revert UI state if backend update fails
      setModerationEnabled(!newModerationState);
      showNotificationMessage(
        'Error', 
        'Failed to update moderation setting',
        'error'
      );
    }
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

  // Fix for track selection - map index back to full playlist index
  const handlePlaySpecificTrack = (index) => {
    const actualIndex = (currentPage - 1) * SONGS_PER_PAGE + index;
    playSpecificTrack(actualIndex);
  };

  // Edit playlist info handlers
  const handleEditInfo = () => {
    setShowEditInfo(true);
  };
  
  const handleSaveInfo = async () => {
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

  if (error || playerError) {
    return (
      <div className="play-room error">
        <h2>Something went wrong</h2>
        <p>{error || playerError}</p>
        <button onClick={() => navigate('/homepage')} className="back-button">
          Go Back
        </button>
      </div>
    );
  }

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
              
              {/* Moderation Section - with improved controls */}
              {isHost && (
                <div className="moderation-section">
                  <div className="moderation-header">
                    <h3>Moderation</h3>
                    <div className="moderation-controls">
                      <button 
                        className={`moderation-toggle ${moderationEnabled ? 'enabled' : 'disabled'}`}
                        onClick={toggleModeration}
                        title={moderationEnabled ? "Moderation On" : "Moderation Off"}
                      >
                        {moderationEnabled ? (
                          <>
                            <ToggleRight size={isMobile ? 16 : 20} /> 
                            <span>On</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft size={isMobile ? 16 : 20} /> 
                            <span>Off</span>
                          </>
                        )}
                      </button>
                      
                      {/* Refresh button for pending requests */}
                      <button 
                        onClick={manualFetchPendingRequests}
                        className="refresh-button"
                        disabled={refreshing}
                        title="Refresh pending requests"
                      >
                        <RefreshCw size={isMobile ? 16 : 18} className={refreshing ? 'spinning' : ''} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Pending Requests section with count badge */}
                  <div className="pending-requests-header">
                    <span>Pending Requests</span>
                    {pendingRequests.length > 0 && (
                      <span className="pending-count">{pendingRequests.length}</span>
                    )}
                  </div>
                  
                  <PendingRequestsSection
                    pendingRequests={pendingRequests}
                    roomName={roomName}
                    onApprove={handleApproveRequest}
                    onReject={handleRejectRequest}
                  />
                </div>
              )}
            </div>
            
            {/* Right Column: Playlist with Pagination */}
            <div className="right-column">
              <PlaylistSection
                playlist={getCurrentPageSongs()}
                fullPlaylistLength={playlist.length}
                isHost={isHost}
                currentTrack={currentTrack}
                roomName={roomName}
                onTrackClick={handlePlaySpecificTrack}
                onTrackDelete={handleTrackDelete}
                onPinToTop={handlePinTrack}
                stopProgressTracking={stopProgressTracking}
                onAddMusicClick={handleSearchMusic}
              />
              
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
        <QRCodeModal
          show={showQRCode}
          roomName={roomName}
          onClose={() => setShowQRCode(false)}
        />
        
        {/* Notification Modal */}
        <RequestNotificationModal
          isOpen={showNotification}
          onClose={() => setShowNotification(false)}
          title={notificationTitle}
          message={notificationMessage}
          type={notificationType}
        />
      </div>
    </MobileResponsiveWrapper>
  );
}

export default PlayRoom;