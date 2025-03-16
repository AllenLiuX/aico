import React from 'react';
import { useUser } from '../../contexts/UserContext';

const UserAvatar = ({ size = 40 }) => {
  const { user } = useUser();

  if (!user || !user.picture) {
    return (
      <div 
        className="rounded-full bg-gray-300 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span className="text-gray-600 text-sm">
          {user?.name ? user.name[0].toUpperCase() : '?'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={user.picture}
      alt={user.name || 'User avatar'}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
};

export default UserAvatar;
