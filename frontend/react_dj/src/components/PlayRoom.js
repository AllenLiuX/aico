// PlayRoom.js (Final Refactored)
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
  QRCodeModal 
} from './playroom-components';
import RequestNotificationModal from './RequestNotificationModal';

import '../styles/PlayRoom.css';

function PlayRoom() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const roomName = queryParams.get('room_name');
  const isHost = queryParams.get('is_host') === 'True';
  const [showQRCode, setShowQRCode] = useState(false);
  
  // Check if we have a valid room name
  useEffect(() => {
    if (!roomName) {
      navigate('/homepage');
    }
  }, [roomName, navigate]);

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
    handleRejectRequest
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
      
      <div className="player-grid">
        {/* Player Controls */}
        <div class= "player-section">
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
          />
          <div ref={playerContainerRef} id="youtube-player"></div>
        </div>
        
       
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
          {/* Placeholder so that the grid layout works as expected */}
          <div></div>
          
          {/* Pending Requests (Host Only) */}
          {isHost && (
            <PendingRequestsSection
              pendingRequests={pendingRequests}
              roomName={roomName}
              onApprove={handleApproveRequest}
              onReject={handleRejectRequest}
            />
          )}
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