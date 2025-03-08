// PlayRoom.js with mobile responsiveness fixes
import React, { useEffect, useState } from 'react';
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
  LyricsSection,
  MobileResponsiveWrapper,
} from './playroom-components';
import RequestNotificationModal from './RequestNotificationModal';
import { ToggleLeft, ToggleRight, Edit } from 'lucide-react';

import '../styles/PlayRoom.css';

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

  // Set up polling for pending requests (host only)
  useEffect(() => {
    if (!isHost || !roomName) return;
    
    const pollInterval = setInterval(() => {
      fetchPendingRequests();
    }, 10000); // Poll every 10 seconds
    
    return () => clearInterval(pollInterval);
  }, [isHost, roomName, fetchPendingRequests]);

  // Handle pin to top action (requires updating playlist state)
  const handlePinTrack = (selectedIndex, currentPlayingIndex) => {
    const newPlaylist = handlePinToTop(selectedIndex, currentPlayingIndex);
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
    setModerationEnabled(newModerationState);
    
    // Update URL parameter
    const params = new URLSearchParams(location.search);
    params.set('moderation', newModerationState ? 'True' : 'False');
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
    
    // Update backend setting if available
    if (updateRoomModeration) {
      try {
        await updateRoomModeration(roomName, newModerationState);
        showNotificationMessage(
          'Moderation Setting Updated', 
          newModerationState 
            ? 'Song requests will now require approval' 
            : 'Song requests will be added directly to the playlist',
          'success'
        );
      } catch (err) {
        console.error('Failed to update moderation setting:', err);
        showNotificationMessage(
          'Error', 
          'Failed to update moderation setting',
          'error'
        );
      }
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
                  onToggleLyrics={() => setShowLyrics(!showLyrics)}
                />
                
                {/* Integrated lyrics section within player */}
                {showLyrics && (
                  <div className="integrated-lyrics">
                    <LyricsSection 
                      currentSong={currentSong}
                      isVisible={showLyrics}
                      currentTime={currentTime}
                    />
                  </div>
                )}
                
                <div ref={playerContainerRef} id="youtube-player" style={{ display: 'none' }}></div>
              </div>
              
              {/* Moderation Section - Directly below player in left column */}
              {isHost && (
                <div className="moderation-section">
                  <div className="moderation-header">
                    <h3>Moderation</h3>
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