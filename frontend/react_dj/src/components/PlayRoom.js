// PlayRoom.js with updated layout and moderation switch
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
  LyricsSection
} from './playroom-components';
import RequestNotificationModal from './RequestNotificationModal';
import { ToggleLeft, ToggleRight } from 'lucide-react';

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
    updateRoomModeration
  } = usePlaylist(roomName, isHost);

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
    <div className="play-room">
      {/* Room Header */}
      <RoomHeader 
        roomName={roomName}
        hostData={hostData}
        showQRCode={showQRCode}
        setShowQRCode={setShowQRCode}
      />
      
      {/* Lyrics Section - Above player and playlist */}
      {showLyrics && (
        <div className="lyrics-container">
          <LyricsSection 
            currentSong={currentSong}
            isVisible={showLyrics}
            currentTime={currentTime}
          />
        </div>
      )}
      
      <div className="player-grid">
        <div className="left-column">
          {/* Player Controls */}
          <div className="player-section">
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
              <div ref={playerContainerRef} id="youtube-player" style={{ display: 'none' }}></div>
            </div>
          </div>
          
          {/* Pending Requests - Now directly below the player on the left */}
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
                      <ToggleRight size={20} /> 
                      <span>On</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft size={20} /> 
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
        
        <div className="right-column">
          {/* Main Playlist */}
          <PlaylistSection
            playlist={playlist}
            isHost={isHost}
            currentTrack={currentTrack}
            roomName={roomName}
            onTrackClick={playSpecificTrack}
            onTrackDelete={handleTrackDelete}
            onPinToTop={handlePinTrack}
            stopProgressTracking={stopProgressTracking}
            onAddMusicClick={handleSearchMusic}
          />
        </div>
      </div>

      {/* Playlist Info */}
      <PlaylistInfoSection
        introduction={introduction}
        settings={settings}
      />

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
  );
}

export default PlayRoom;