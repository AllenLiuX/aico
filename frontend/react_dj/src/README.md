# Social Features Implementation Guide

This guide explains how to implement social features (favorite rooms, follow/unfollow users) in your AICO Music app.

## Backend Implementation

### 1. Add Backend API Endpoints

Add the following endpoints to your `app.py` file:

- `/api/user/favorites` (GET): Get user's favorite rooms
- `/api/user/following` (GET): Get list of users the current user is following
- `/api/user/followers` (GET): Get list of users following the current user
- `/api/user/follow` (POST): Follow or unfollow a user
- `/api/user/favorite` (POST): Add or remove a room from user's favorites

Copy the code from the "Backend API Endpoints for Social Features" artifact and add it to your app.py file.

### 2. Install Dependencies

Make sure Redis is properly configured as these endpoints rely on Redis for data storage.

## Frontend Implementation

### 1. Create the SocialActionButtons Component

1. Create a new file `SocialActionButtons.js` in your components directory
2. Copy the code from the "SocialActionButtons.js Component" artifact
3. Create the CSS file `SocialActionButtons.css` in your styles directory
4. Copy the CSS code from the "SocialActionButtons.css" artifact

### 2. Update the RoomHeader Component

1. Open your `RoomHeader.js` file
2. Replace the content with the code from the "Updated RoomHeader.js with Social Buttons" artifact
3. Make sure to import the SocialActionButtons component

### 3. Update the PlayRoom Component

1. Open your `PlayRoom.js` file
2. Update the RoomHeader component usage to pass the roomInfo prop:

```jsx
<RoomHeader 
  roomName={roomName}
  hostData={hostData}
  showQRCode={showQRCode}
  setShowQRCode={setShowQRCode}
  roomInfo={settings}
/>
```

### 4. Update the Profile Component for Social Features

1. Open your `Profile.js` file
2. Import the necessary icons:
```jsx
import { Music, Plus, MapPin, Calendar, Edit2, Users, Star, UserPlus, UserMinus } from 'lucide-react';
```
3. Add the state variables for favorites, following, and followers:
```jsx
const [favoriteRooms, setFavoriteRooms] = useState([]);
const [followingUsers, setFollowingUsers] = useState([]);
const [followerUsers, setFollowerUsers] = useState([]);
const [activeTab, setActiveTab] = useState('rooms');
```
4. Update the useEffect hook to fetch social data as shown in the "Updated Profile.js for Social Features" artifact
5. Add the tab navigation and content sections from the artifact
6. Add the UserCard component from the artifact

### 5. Add CSS for Profile Social Features

1. Open your `Profile.css` file
2. Add the CSS from the "CSS Updates for Profile Social Features" artifact

## Testing

After implementation, test the following functionality:

1. Favorite a room by clicking the "Favorite" button in the room header
2. Follow a room creator by clicking the "Follow" button in the room header
3. View your favorite rooms in the "Favorites" tab of your profile
4. View users you're following in the "Following" tab of your profile
5. View your followers in the "Followers" tab of your profile
6. Unfollow a user from the "Following" tab

## Troubleshooting

- If buttons don't work, check the browser console for API errors
- Ensure Redis is properly configured and running
- Verify that user authentication is working correctly
- Check that all necessary components and styles are properly imported

For any issues, refer to the backend logs for detailed error messages.