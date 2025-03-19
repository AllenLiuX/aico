// API configuration
export const host_by_https = true;
// export const API_URL = "http://13.56.253.58:5000";
export const API_URL = host_by_https 
  ? "https://aico-music.com" 
  : "http://3.101.133.162:5000";
// export const API_URL = "https://api.aico-remix.com";
export const FRONTEND_URL = host_by_https 
  ? "https://aico-music.com" 
  : "http://aico-music.com";

// Other configuration constants can be added here
export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    GOOGLE: `${API_URL}/api/auth/google`,
  },
  // Playlist endpoints
  PLAYLIST: {
    CREATE: `${API_URL}/api/playlist/create`,
    GET: `${API_URL}/api/playlist`,
    UPDATE: `${API_URL}/api/playlist/update`,
    DELETE: `${API_URL}/api/playlist/delete`,
  },
  // Room endpoints
  ROOM: {
    CREATE: `${API_URL}/api/room/create`,
    JOIN: `${API_URL}/api/room/join`,
    GET: `${API_URL}/api/room`,
  },
  // Music endpoints
  MUSIC: {
    SEARCH: `${API_URL}/api/music/search`,
  },
};
