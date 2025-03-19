// formatRoomName.js
// Utility function to format room names, especially for favorites rooms

/**
 * Formats a room name for display
 * Converts "favorites_username" to "username's favorites"
 * @param {string} roomName - The original room name
 * @returns {string} - The formatted room name
 */
export const formatRoomName = (roomName) => {
  if (!roomName) return '';
  
  // Check if it's a favorites room (starts with "favorites_")
  if (roomName.startsWith('favorites_')) {
    const username = roomName.substring(10); // Remove "favorites_" prefix
    return `${username}'s Favorites`;
  }
  
  // Return the original room name for non-favorites rooms
  return roomName;
};

export default formatRoomName;
