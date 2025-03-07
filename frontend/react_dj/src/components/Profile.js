// Profile.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, Plus, MapPin, Calendar, Edit2, Users } from 'lucide-react';
import AvatarUpload from './AvatarUpload';
import '../styles/Profile.css';

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
          {room.genre && <span className="tag genre-tag">{room.genre}</span>}
          {room.occasion && <span className="tag occasion-tag">{room.occasion}</span>}
        </div>
      </div>
    </div>
  );
};

const CreateRoomCard = ({ onClick }) => (
  <div className="room-card create-card" onClick={onClick}>
    <div className="create-content">
      <Plus size={32} />
    </div>
  </div>
);

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
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const [profileRes, roomsRes] = await Promise.all([
          // fetch('http://127.0.0.1:5000/api/user/profile', {
          fetch('http://13.56.253.58:5000/api/user/profile', {
            headers: { 'Authorization': token }
          }),
          // fetch('http://127.0.0.1:5000/api/user/rooms', {
          fetch('http://13.56.253.58:5000/api/user/rooms', {
            headers: { 'Authorization': token }
          })
        ]);

        if (!profileRes.ok || !roomsRes.ok) throw new Error('Failed to fetch data');

        const profileData = await profileRes.json();
        const roomsData = await roomsRes.json();

        setUser(profileData);
        setRooms(roomsData.rooms || []);
        setEditForm(profileData);
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
      const response = await fetch('http://13.56.253.58:5000/api/user/profile', {
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

  const stats = [
    { label: 'Rooms', value: rooms.length },
    { label: 'Favorites', value: user.stats?.favorites || 0 },
    { label: 'Following', value: user.stats?.following || 0 },
    { label: 'Followers', value: user.stats?.followers || 0 }
  ];

  // Helper function to get full avatar URL
  const getFullAvatarUrl = (avatarPath) => {
    if (!avatarPath) return null;
    if (avatarPath.startsWith('http')) return avatarPath;
    return `http://13.56.253.58:5000${avatarPath}`;
  };

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div className="profile-main">
          <div className="avatar-container" onClick={() => setShowAvatarUpload(!showAvatarUpload)}>
            {/* <img
              src={user.avatar || `/api/avatar/${user.username}`}
              alt="Profile"
              className="avatar"
            /> */}
            <img
              src={getFullAvatarUrl(user.avatar) || `/api/avatar/${user.username}`}
              alt="Profile"
              className="avatar"
            />
            <AvatarUpload
              show={showAvatarUpload}
              onClose={() => setShowAvatarUpload(false)}
              onUpload={handleAvatarUpload}
            />
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
              <button className="edit-btn" onClick={isEditing ? handleSubmit : handleEdit}>
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
                <button className="cancel-btn" onClick={handleCancel}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rooms-section">
        <h2>
          <Users size={16} />
          Your Rooms <span className="count">({rooms.length})</span>
        </h2>
        <div className="rooms-grid">
          {rooms.map(room => (
            <RoomCard key={room.name} room={room} />
          ))}
          <div className="room-card create-card" onClick={() => navigate('/create_room')}>
            <Plus size={32} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;