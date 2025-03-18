// Profile.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, Plus, MapPin, Calendar, Edit2, Users, Star, UserPlus, UserMinus } from 'lucide-react';
import AvatarUpload from './AvatarUpload';
import Avatar from './common/Avatar';
import '../styles/Profile.css';
import { API_URL } from '../config';

// Available tags for selection
const AVAILABLE_TAGS = {
  genres: ['Pop', 'Rock', 'Hip Hop', 'Jazz', 'Classical', 'Electronic', 'R&B', 'Country'],
  languages: ['English', 'Chinese', 'Spanish', 'Japanese', 'Korean', 'French'],
  styles: ['Dance', 'Acoustic', 'Instrumental', 'Vocal', 'Live', 'Studio'],
  artists: ['Taylor Swift', 'Ed Sheeran', 'Jay Chou', 'Eason Chan', 'BTS']
};

const TagSelector = ({ selectedTags, onTagSelect }) => {
  const [category, setCategory] = useState('genres');
  
  return (
    <div className="tag-selector">
      <div className="tag-categories">
        {Object.keys(AVAILABLE_TAGS).map(cat => (
          <button 
            key={cat}
            className={`category-btn ${category === cat ? 'active' : ''}`}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="available-tags">
        {AVAILABLE_TAGS[category].map(tag => (
          <button
            key={tag}
            className={`tag-btn ${selectedTags.includes(tag) ? 'selected' : ''}`}
            onClick={() => onTagSelect(tag)}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
};

const RoomCard = ({ room }) => {
  const navigate = useNavigate();

  const handleRoomClick = () => {
    navigate(`/playroom?room_name=${room.name}&is_host=True`);
  };

  return (
    <div className="room-card" onClick={handleRoomClick}>
      <div className="room-image">
        <img
          src={room.cover_image || '/api/placeholder/300/200'}
          alt={room.name}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/api/placeholder/300/200';
          }}
        />
        <div className="song-count">
          <Music size={14} />
          <span>{room.song_count} songs</span>
        </div>
      </div>
      <div className="room-content">
        <h3>{room.name}</h3>
        <p>{room.introduction}</p>
        <div className="room-tags">
          {room.genre && <span className="tag">{room.genre}</span>}
          {room.occasion && <span className="tag">{room.occasion}</span>}
        </div>
      </div>
    </div>
  );
};

// User Card component for following/followers
const UserCard = ({ user, onUnfollow, isFollower = false }) => {
  const navigate = useNavigate();

  const handleProfileClick = () => {
    // We would navigate to the user's profile if that feature exists
    // For now, just log the action
    console.log(`View profile of ${user.username}`);
  };

  return (
    <div className="user-card">
      <div className="user-card-content" onClick={handleProfileClick}>
        <img 
          src={user.avatar || `/api/avatar/${user.username}`}
          alt={user.username}
          className="user-avatar"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/api/placeholder/64/64';
          }}
        />
        <div className="user-info">
          <h3>{user.username}</h3>
        </div>
      </div>
      {!isFollower && onUnfollow && (
        <button 
          className="unfollow-button" 
          onClick={(e) => {
            e.stopPropagation();
            onUnfollow();
          }}
        >
          <UserMinus size={16} />
          <span>Unfollow</span>
        </button>
      )}
    </div>
  );
};

function Profile() {
  const [user, setUser] = useState({
    username: '',
    email: '',
    age: null,
    country: '',
    sex: '',
    bio: '',
    avatar: '',
    tags: [],
    stats: {
      rooms: 0,
      favorites: 0,
      following: 0,
      followers: 0
    }
  });
  
  const [rooms, setRooms] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showAvatarUpload, setShowAvatarUpload] = useState(false);
  
  // New state for social features
  const [favoriteRooms, setFavoriteRooms] = useState([]);
  const [followingUsers, setFollowingUsers] = useState([]);
  const [followerUsers, setFollowerUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('rooms'); // 'rooms', 'favorites', 'following', or 'followers'
  
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        // Fetch all user data in parallel
        const [profileRes, roomsRes, favoritesRes, followingRes, followersRes] = await Promise.all([
          fetch(`${API_URL}/api/user/profile`, {
            headers: { 'Authorization': token }
          }),
          fetch(`${API_URL}/api/user/rooms`, {
            headers: { 'Authorization': token }
          }),
          fetch(`${API_URL}/api/user/favorites?detailed=true`, {
            headers: { 'Authorization': token }
          }),
          fetch(`${API_URL}/api/user/following?detailed=true`, {
            headers: { 'Authorization': token }
          }),
          fetch(`${API_URL}/api/user/followers?detailed=true`, {
            headers: { 'Authorization': token }
          })
        ]);

        if (!profileRes.ok || !roomsRes.ok) throw new Error('Failed to fetch data');

        const profileData = await profileRes.json();
        const roomsData = await roomsRes.json();

        setUser(profileData);
        setRooms(roomsData.rooms || []);
        setEditForm(profileData);
        
        // Handle social data responses
        if (favoritesRes.ok) {
          const favoritesData = await favoritesRes.json();
          setFavoriteRooms(favoritesData.rooms || []);
        }
        
        if (followingRes.ok) {
          const followingData = await followingRes.json();
          setFollowingUsers(followingData.users || []);
        }
        
        if (followersRes.ok) {
          const followersData = await followersRes.json();
          setFollowerUsers(followersData.users || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchUserData();
  }, []);

  const handleEdit = () => {
    setIsEditing(true);
    setEditForm(user);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditForm(user);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTagSelect = (tag) => {
    setEditForm(prev => {
      const currentTags = prev.tags || [];
      return {
        ...prev,
        tags: currentTags.includes(tag) 
          ? currentTags.filter(t => t !== tag)
          : [...currentTags, tag]
      };
    });
  };

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/user/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        setUser(editForm);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const handleAvatarUpload = (newAvatarUrl) => {
    // Update local state
    setUser(prev => ({
      ...prev,
      avatar: newAvatarUrl
    }));

    // Update user data in localStorage
    const userData = JSON.parse(localStorage.getItem('user'));
    if (userData) {
      userData.avatar = newAvatarUrl;
      localStorage.setItem('user', JSON.stringify(userData));
    }

    // Update profile data in local state
    setEditForm(prev => ({
      ...prev,
      avatar: newAvatarUrl
    }));
  };
  
  // Function to handle tab switching
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };
  
  // Function to handle unfollowing a user
  const handleUnfollow = async (targetUsername) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/user/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({
          username: targetUsername,
          action: 'unfollow'
        })
      });

      if (!response.ok) throw new Error('Failed to unfollow user');

      // Update the following list by removing the unfollowed user
      setFollowingUsers(prevUsers => 
        prevUsers.filter(user => user.username !== targetUsername)
      );
    } catch (error) {
      console.error('Error unfollowing user:', error);
    }
  };

  // Helper function to get full avatar URL
  const getFullAvatarUrl = (avatarPath) => {
    if (!avatarPath) return null;
    if (avatarPath.startsWith('http')) return avatarPath;
    return `${API_URL}${avatarPath}`;
  };

  // Calculate stats for display
  const stats = [
    { label: 'Rooms', value: rooms.length },
    { label: 'Favorites', value: favoriteRooms.length },
    { label: 'Following', value: followingUsers.length },
    { label: 'Followers', value: followerUsers.length }
  ];

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div className="profile-main">
          <div className="avatar-section">
            <div className="avatar-wrapper">
              <Avatar 
                src={user.avatar}
                username={user.username}
                size={120}
              />
              <button 
                className="edit-avatar-btn" 
                onClick={() => setShowAvatarUpload(true)}
              >
                <Edit2 size={16} />
              </button>
            </div>
            {showAvatarUpload && (
              <AvatarUpload 
                show={showAvatarUpload}
                onClose={() => setShowAvatarUpload(false)}
                onUpload={handleAvatarUpload}
              />
            )}
          </div>
          <div className="profile-info">
            <div className="top-row">
              <h1>{user.username}</h1>
              <div className="stats">
                {stats.map(stat => (
                  <div key={stat.label} className="stat-item">
                    <span className="value">{stat.value}</span>
                    <span className="label">{stat.label}</span>
                  </div>
                ))}
              </div>
              <button 
                className="edit-btn" 
                onClick={isEditing ? handleSubmit : handleEdit}
              >
                {isEditing ? 'Save Profile' : (
                  <>
                    <Edit2 size={16} />
                    Edit Profile
                  </>
                )}
              </button>
            </div>

            {!isEditing ? (
              <>
                <div className="user-meta">
                  <MapPin size={14} />
                  <span>{user.country}</span>
                  {user.age >= 21 && (
                    <>
                      <Calendar size={14} />
                      <span>{user.age} years old</span>
                    </>
                  )}
                </div>
                <p className="bio">{user.bio}</p>
                {user.tags?.length > 0 && (
                  <div className="user-tags">
                    {user.tags.map(tag => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="edit-form">
                <input
                  type="text"
                  name="country"
                  placeholder="Country"
                  value={editForm.country || ''}
                  onChange={handleChange}
                />
                <input
                  type="number"
                  name="age"
                  placeholder="Age"
                  value={editForm.age || ''}
                  onChange={handleChange}
                />
                <textarea
                  name="bio"
                  placeholder="Bio"
                  value={editForm.bio || ''}
                  onChange={handleChange}
                  rows={2}
                />
                <TagSelector
                  selectedTags={editForm.tags || []}
                  onTagSelect={handleTagSelect}
                />
                <button 
                  className="cancel-btn" 
                  onClick={handleCancel}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="profile-tabs">
        <button 
          className={`tab-button ${activeTab === 'rooms' ? 'active' : ''}`}
          onClick={() => handleTabChange('rooms')}
        >
          Rooms ({rooms.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'favorites' ? 'active' : ''}`}
          onClick={() => handleTabChange('favorites')}
        >
          Favorites ({favoriteRooms.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'following' ? 'active' : ''}`}
          onClick={() => handleTabChange('following')}
        >
          Following ({followingUsers.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'followers' ? 'active' : ''}`}
          onClick={() => handleTabChange('followers')}
        >
          Followers ({followerUsers.length})
        </button>
      </div>

      {/* Tab content - User's Rooms */}
      {activeTab === 'rooms' && (
        <div className="rooms-section">
          <h2>
            <Users size={16} />
            Your Rooms <span className="count">({rooms.length})</span>
          </h2>
          <div className="rooms-grid">
            {rooms.map(room => (
              <RoomCard key={room.name} room={room} />
            ))}
            <div 
              className="room-card create-card"
              onClick={() => navigate('/create_room')}
            >
              <Plus size={32} />
            </div>
          </div>
        </div>
      )}

      {/* Tab content - Favorite Rooms */}
      {activeTab === 'favorites' && (
        <div className="rooms-section">
          <h2>
            <Star size={16} />
            Favorite Rooms <span className="count">({favoriteRooms.length})</span>
          </h2>
          {favoriteRooms.length > 0 ? (
            <div className="rooms-grid">
              {favoriteRooms.map(room => (
                <RoomCard key={room.name} room={room} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>You haven't favorited any rooms yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab content - Following Users */}
      {activeTab === 'following' && (
        <div className="users-section">
          <h2>
            <UserPlus size={16} />
            Following <span className="count">({followingUsers.length})</span>
          </h2>
          {followingUsers.length > 0 ? (
            <div className="users-grid">
              {followingUsers.map(user => (
                <UserCard 
                  key={user.username} 
                  user={user} 
                  onUnfollow={() => handleUnfollow(user.username)}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>You aren't following anyone yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab content - Followers */}
      {activeTab === 'followers' && (
        <div className="users-section">
          <h2>
            <Users size={16} />
            Followers <span className="count">({followerUsers.length})</span>
          </h2>
          {followerUsers.length > 0 ? (
            <div className="users-grid">
              {followerUsers.map(user => (
                <UserCard 
                  key={user.username} 
                  user={user}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>You don't have any followers yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Profile;