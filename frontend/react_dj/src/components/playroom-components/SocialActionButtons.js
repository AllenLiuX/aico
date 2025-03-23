// Updated SocialActionButtons.js component
import React, { useState, useEffect } from 'react';
import { Star, Heart, UserPlus, UserMinus } from 'lucide-react';
import { API_URL } from '../../config';
import '../../styles/SocialActionButtons.css';

const SocialActionButtons = ({ roomName, hostUsername, roomInfo }) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [userData, setUserData] = useState(null);

  // Check if user is logged in and get their data
  useEffect(() => {
    const userDataStr = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    const userData = userDataStr ? JSON.parse(userDataStr) : null;
    
    setAuthorized(!!token);
    setUserData(userData);
    
    if (token && userData) {
      // Check if room is favorited
      checkFavoriteStatus(roomName);
      
      // Check if user is following the host
      if (hostUsername && hostUsername !== userData.username) {
        checkFollowingStatus(hostUsername);
      }
    }

    // Debug log to check if component is rendering
    console.log("SocialActionButtons initialized", {
      roomName,
      hostUsername,
      userData: userData?.username,
      authorized: !!token
    });
  }, [roomName, hostUsername]);

  // Check if room is in user's favorites
  const checkFavoriteStatus = async (roomName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/user/favorites`, {
        headers: {
          'Authorization': token
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const favorites = data.favorites || [];
        // Check if the room is in favorites by comparing room names
        const isFavorited = favorites.some(room => room.name === roomName);
        setIsFavorite(isFavorited);
        console.log("Favorite check complete", {isFavorite: isFavorited, favorites});
      }
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
  };

  // Check if user is following the host
  const checkFollowingStatus = async (hostUsername) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/user/following`, {
        headers: {
          'Authorization': token
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const following = data.following || [];
        setIsFollowing(following.includes(hostUsername));
        console.log("Following check complete", {isFollowing: following.includes(hostUsername)});
      }
    } catch (error) {
      console.error('Error checking following status:', error);
    }
  };

  // Handle favoriting/unfavoriting a room
  const handleFavoriteToggle = async () => {
    if (!authorized) {
      setMessage('Please login to favorite rooms');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    
    setIsLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/user/favorite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({
          room_name: roomName,
          action: isFavorite ? 'remove' : 'add'
        })
      });
      
      if (response.ok) {
        setIsFavorite(!isFavorite);
        setMessage(isFavorite ? 'Removed from favorites' : 'Added to favorites');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Operation failed. Please try again.');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      setMessage('Operation failed. Please try again.');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle following/unfollowing a user
  const handleFollowToggle = async () => {
    if (!authorized) {
      setMessage('Please login to follow users');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    
    // Don't allow users to follow themselves
    if (userData && userData.username === hostUsername) {
      setMessage('You cannot follow yourself');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    
    setIsLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/user/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({
          username: hostUsername,
          action: isFollowing ? 'unfollow' : 'follow'
        })
      });
      
      if (response.ok) {
        setIsFollowing(!isFollowing);
        setMessage(isFollowing ? 'Unfollowed' : 'Following');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Operation failed. Please try again.');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      setMessage('Operation failed. Please try again.');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show follow button for the room creator
  const shouldShowFollowButton = hostUsername && userData && hostUsername !== userData.username;

  // Render both buttons in all cases (for debugging)
  return (
    <div className="social-actions">
      <button 
        className={`action-button favorite-button ${isFavorite ? 'active' : ''}`}
        onClick={handleFavoriteToggle}
        disabled={isLoading}
        title={isFavorite ? "Remove from favorites" : "Add to favorites"}
      >
        <Star size={16} />
        <span>{isFavorite ? "Favorited" : "Favorite"}</span>
      </button>
      
      {shouldShowFollowButton && (
        <button 
          className={`action-button follow-button ${isFollowing ? 'active' : ''}`}
          onClick={handleFollowToggle}
          disabled={isLoading}
          title={isFollowing ? "Unfollow" : "Follow"}
        >
          {isFollowing ? (
            <>
              <UserMinus size={16} />
              <span>Unfollow</span>
            </>
          ) : (
            <>
              <UserPlus size={16} />
              <span>Follow</span>
            </>
          )}
        </button>
      )}
      
      {message && (
        <div className="action-message">
          {message}
        </div>
      )}
    </div>
  );
};

export default SocialActionButtons;