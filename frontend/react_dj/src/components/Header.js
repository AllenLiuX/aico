// Header.js
import React, { useState, useEffect, useRef, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserCircle } from 'lucide-react';
import AuthModal from './AuthModal';
import ProfileDropdown from './ProfileDropdown';
import { UserContext } from '../contexts/UserContext';
import '../styles/Header.css';
import { API_URL, host_by_https } from '../config';
import Avatar from './common/Avatar';

function Header() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const { user, logout } = useContext(UserContext);
  const [isIOS, setIsIOS] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if running in Capacitor iOS environment
    const checkPlatform = async () => {
      try {
        // This will only work in a Capacitor environment
        if (window.Capacitor && window.Capacitor.getPlatform() === 'ios') {
          setIsIOS(true);
        }
      } catch (e) {
        // Not in a Capacitor environment, do nothing
      }
    };
    
    checkPlatform();

    const handleClickOutside = (event) => {
      if (dropdownRef.current && 
          buttonRef.current && 
          !dropdownRef.current.contains(event.target) && 
          !buttonRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    if (isIOS) {
      document.addEventListener('touchend', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (isIOS) {
        document.removeEventListener('touchend', handleClickOutside);
      }
    };
  }, [isIOS]);

  const handleLogout = () => {
    logout();
    setShowDropdown(false);
  };

  const getFullAvatarUrl = (avatarPath) => {
    if (!avatarPath) return null;
    
    // If it's already a full URL
    if (avatarPath.startsWith('http')) {
      // Convert HTTP to HTTPS if needed
      if (avatarPath.startsWith('http:') && host_by_https) {
        return avatarPath.replace('http:', 'https:');
      }
      return avatarPath;
    }
    
    // Otherwise, prepend the API_URL
    return `${API_URL}${avatarPath}`;
  };
  
  // Navigation handlers for iOS
  const navigateTo = (path) => {
    navigate(path);
  };
  
  // Conditionally render links based on platform
  const renderNavLink = (to, text) => {
    if (isIOS) {
      return (
        <Link 
          to={to} 
          className="nav-link"
          onClick={(e) => {
            e.preventDefault();
            navigateTo(to);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            navigateTo(to);
          }}
        >
          {text}
        </Link>
      );
    } else {
      return (
        <Link to={to} className="nav-link">
          {text}
        </Link>
      );
    }
  };
  
  return (
    <header className={`main-header ${isIOS ? 'ios-device' : ''}`}>
      <div className="header-container">
        <nav>
          <ul className="nav-list">
            <li>{renderNavLink("/", "Home")}</li>
            <li>{renderNavLink("/explore", "Explore")}</li>
            <li>{renderNavLink("/about", "About Us")}</li>
          </ul>
        </nav>

        <div className="user-section">
          {user ? (
            <>
              <button
                ref={buttonRef}
                onClick={() => setShowDropdown(!showDropdown)}
                onTouchEnd={isIOS ? (e) => {
                  e.preventDefault();
                  setShowDropdown(!showDropdown);
                } : undefined}
                className="profile-button"
              >
                <Avatar 
                  src={user.avatar ? getFullAvatarUrl(user.avatar) : null}
                  username={user.username}
                  size={32}
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
              onTouchEnd={isIOS ? (e) => {
                e.preventDefault();
                setShowAuthModal(true);
              } : undefined}
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