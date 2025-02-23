// ProfileDropdown.js
import React from 'react';
import { Link } from 'react-router-dom';
import { User, LogOut } from 'lucide-react';
import '../styles/ProfileDropdown.css';

const ProfileDropdown = ({ onLogout }) => {
  return (
    <div className="profile-dropdown">
      <Link to="/profile" className="dropdown-item">
        <User size={18} />
        <span>Profile</span>
      </Link>
      <button onClick={onLogout} className="dropdown-item">
        <LogOut size={18} />
        <span>Logout</span>
      </button>
    </div>
  );
};

export default ProfileDropdown;