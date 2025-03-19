// Header.js
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { UserCircle } from 'lucide-react';
import AuthModal from './AuthModal';
import ProfileDropdown from './ProfileDropdown';
import '../styles/Header.css';
import { API_URL } from '../config';

function Header() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [user, setUser] = useState(null);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }

    const handleClickOutside = (event) => {
      if (dropdownRef.current && 
          buttonRef.current && 
          !dropdownRef.current.contains(event.target) && 
          !buttonRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
    setShowDropdown(false);
  };

  const getFullAvatarUrl = (avatarPath) => {
    if (!avatarPath) return null;
    if (avatarPath.startsWith('http')) return avatarPath;
    return `${API_URL}${avatarPath}`;
  };
  
  return (
    <header className="main-header">
      <div className="header-container">
        <nav>
          <ul className="nav-list">
            <li><Link to="/" className="nav-link">Home</Link></li>
            <li><Link to="/explore" className="nav-link">Explore</Link></li>
            <li><Link to="/about" className="nav-link">About Us</Link></li>
          </ul>
        </nav>

        <div className="user-section">
          {user ? (
            <>
              <button
                ref={buttonRef}
                onClick={() => setShowDropdown(!showDropdown)}
                className="profile-button"
              >
                {/* <img
                  src={user.avatar}
                  alt="Profile"
                  className="profile-avatar"
                /> */}
                <img
                  src={getFullAvatarUrl(user.avatar) || `/api/avatar/${user.username}`}
                  alt="Profile"
                  className="profile-avatar"
                />
                <span className="profile-name">{user.username}</span>
              </button>
              {showDropdown && (
                <div ref={dropdownRef}>
                  <ProfileDropdown onLogout={handleLogout} />
                </div>
              )}
            </>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="login-button"
            >
              <UserCircle size={24} />
              <span>Login</span>
            </button>
          )}
        </div>
      </div>
      
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </header>
  );
}

export default Header;