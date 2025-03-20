"""
User Activity Logging Module

This module provides functionality to log and retrieve user activities in the application.
It tracks various user actions such as:

1. Authentication Actions:
   - Login: When a user logs into the application
   - Logout: When a user logs out of the application
   - Registration: When a new user registers

2. Room-related Actions:
   - Join Room: When a user joins a music room
   - Leave Room: When a user leaves a music room
   - Create Room: When a user creates a new room
   - Favorite Room: When a user adds a room to favorites
   - Unfavorite Room: When a user removes a room from favorites

3. Song-related Actions:
   - Play Song: When a user plays a song
   - Pause Song: When a user pauses a song
   - Add Song: When a user adds a song to a playlist
   - Remove Song: When a user removes a song from a playlist
   - Favorite Song: When a user favorites a song

All logs are stored in Redis with timestamps and relevant details to enable:
- User behavior analysis
- Personalized recommendations
- Usage statistics and analytics
- Debugging user issues
"""

import redis
import json
from datetime import datetime
import logging
import os

# Set up logging
logger = logging.getLogger(__name__)

# Connect to Redis
redis_client = redis.Redis(host='localhost', port=6379, db=0)
redis_version = '_v1'

# User activity log key format: user_logs:{version}:{username}
# Each user's log is a sorted set with timestamp as score and activity JSON as value

def log_user_activity(username, action, details=None, room_name=None, song_id=None):
    """
    Log user activity to Redis.
    
    Args:
        username: The username of the user
        action: The action performed (login, logout, create_room, join_room, etc.)
        details: Additional details about the action (optional)
        room_name: Related room name (optional)
        song_id: Related song ID (optional)
    
    Returns:
        bool: True if logging was successful, False otherwise
    """
    try:
        # Create activity log entry
        timestamp = datetime.now().isoformat()
        log_entry = {
            "timestamp": timestamp,
            "action": action,
            "username": username
        }
        
        # Add optional fields if provided
        if details:
            log_entry["details"] = details
        if room_name:
            log_entry["room_name"] = room_name
        if song_id:
            log_entry["song_id"] = song_id
            
        # Convert to JSON string
        log_json = json.dumps(log_entry)
        
        # Get current timestamp as score for sorted set
        score = datetime.now().timestamp()
        
        # Add to user's activity log (sorted set)
        user_log_key = f"user_logs{redis_version}:{username}"
        redis_client.zadd(user_log_key, {log_json: score})
        
        # Also add to global activity log
        global_log_key = f"global_logs{redis_version}"
        redis_client.zadd(global_log_key, {log_json: score})
        
        logger.info(f"Logged activity for user {username}: {action}")
        return True
    except Exception as e:
        logger.error(f"Error logging user activity: {str(e)}")
        return False

def get_user_activity_logs(username, limit=50, start=0):
    """
    Get user activity logs from Redis.
    
    Args:
        username: The username to get logs for
        limit: Maximum number of logs to return
        start: Starting index for pagination
    
    Returns:
        list: List of activity log entries as dictionaries
    """
    try:
        user_log_key = f"user_logs{redis_version}:{username}"
        
        # Get logs from sorted set (newest first)
        log_entries = redis_client.zrevrange(user_log_key, start, start + limit - 1)
        
        # Parse JSON entries
        logs = []
        for entry in log_entries:
            logs.append(json.loads(entry.decode('utf-8')))
            
        return logs
    except Exception as e:
        logger.error(f"Error getting user activity logs: {str(e)}")
        return []

def get_global_activity_logs(limit=50, start=0):
    """
    Get global activity logs from Redis.
    
    Args:
        limit: Maximum number of logs to return
        start: Starting index for pagination
    
    Returns:
        list: List of activity log entries as dictionaries
    """
    try:
        global_log_key = f"global_logs{redis_version}"
        
        # Get logs from sorted set (newest first)
        log_entries = redis_client.zrevrange(global_log_key, start, start + limit - 1)
        
        # Parse JSON entries
        logs = []
        for entry in log_entries:
            logs.append(json.loads(entry.decode('utf-8')))
            
        return logs
    except Exception as e:
        logger.error(f"Error getting global activity logs: {str(e)}")
        return []

def get_room_activity_logs(room_name, limit=50, start=0):
    """
    Get activity logs for a specific room from Redis.
    
    Args:
        room_name: The room to get logs for
        limit: Maximum number of logs to return
        start: Starting index for pagination
    
    Returns:
        list: List of activity log entries as dictionaries
    """
    try:
        global_log_key = f"global_logs{redis_version}"
        
        # Get all logs from sorted set (newest first)
        all_log_entries = redis_client.zrevrange(global_log_key, 0, -1)
        
        # Filter logs for the specific room
        room_logs = []
        for entry in all_log_entries:
            log_data = json.loads(entry.decode('utf-8'))
            if log_data.get('room_name') == room_name:
                room_logs.append(log_data)
                
                # Break if we've reached the limit
                if len(room_logs) >= start + limit:
                    break
                    
        # Apply pagination
        return room_logs[start:start+limit]
    except Exception as e:
        logger.error(f"Error getting room activity logs: {str(e)}")
        return []

def clear_user_logs(username):
    """
    Clear all activity logs for a user.
    
    Args:
        username: The username to clear logs for
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        user_log_key = f"user_logs{redis_version}:{username}"
        redis_client.delete(user_log_key)
        return True
    except Exception as e:
        logger.error(f"Error clearing user logs: {str(e)}")
        return False

def export_user_song_interactions(limit=10000):
    """
    Export user-song interactions in a format suitable for recommendation systems.
    
    Returns:
        list: List of dictionaries with user-song interaction data
    """
    try:
        global_log_key = f"global_logs{redis_version}"
        
        # Get all logs from sorted set (newest first)
        all_log_entries = redis_client.zrevrange(global_log_key, 0, limit)
        
        # Parse JSON entries and filter for song-related actions
        song_interactions = []
        song_related_actions = [
            "play_song", "pause_song", "favorite_song", 
            "add_song", "remove_song"
        ]
        
        for entry in all_log_entries:
            log_data = json.loads(entry.decode('utf-8'))
            
            # Only include song-related actions with song_id
            if log_data.get('action') in song_related_actions and log_data.get('song_id'):
                # Create a standardized interaction record
                interaction = {
                    "user_id": log_data.get('username'),
                    "song_id": log_data.get('song_id'),
                    "timestamp": log_data.get('timestamp'),
                    "action": log_data.get('action')
                }
                
                # Add additional fields if available
                if log_data.get('details'):
                    if 'title' in log_data['details']:
                        interaction['song_title'] = log_data['details']['title']
                    if 'artist' in log_data['details']:
                        interaction['artist'] = log_data['details']['artist']
                    if 'position' in log_data['details']:
                        interaction['position'] = log_data['details']['position']
                
                if log_data.get('room_name'):
                    interaction['room_id'] = log_data['room_name']
                
                song_interactions.append(interaction)
                
        return song_interactions
    except Exception as e:
        logger.error(f"Error exporting user-song interactions: {str(e)}")
        return []

def export_user_room_interactions(limit=10000):
    """
    Export user-room interactions in a format suitable for recommendation systems.
    
    Returns:
        list: List of dictionaries with user-room interaction data
    """
    try:
        global_log_key = f"global_logs{redis_version}"
        
        # Get all logs from sorted set (newest first)
        all_log_entries = redis_client.zrevrange(global_log_key, 0, limit)
        
        # Parse JSON entries and filter for room-related actions
        room_interactions = []
        room_related_actions = [
            "create_room", "join_room", "leave_room", 
            "favorite_room", "unfavorite_room"
        ]
        
        for entry in all_log_entries:
            log_data = json.loads(entry.decode('utf-8'))
            
            # Only include room-related actions with room_name
            if log_data.get('action') in room_related_actions and log_data.get('room_name'):
                # Create a standardized interaction record
                interaction = {
                    "user_id": log_data.get('username'),
                    "room_id": log_data.get('room_name'),
                    "timestamp": log_data.get('timestamp'),
                    "action": log_data.get('action')
                }
                
                # Add additional fields if available
                if log_data.get('details'):
                    if 'is_host' in log_data['details']:
                        interaction['is_host'] = log_data['details']['is_host']
                    if 'duration' in log_data['details']:
                        interaction['duration'] = log_data['details']['duration']
                
                room_interactions.append(interaction)
                
        return room_interactions
    except Exception as e:
        logger.error(f"Error exporting user-room interactions: {str(e)}")
        return []

def export_song_features():
    """
    Export song features by aggregating data from user logs.
    
    Returns:
        list: List of dictionaries with song features
    """
    try:
        # Get all song interactions
        song_interactions = export_user_song_interactions()
        
        # Extract unique songs and their features
        song_features = {}
        
        for interaction in song_interactions:
            song_id = interaction.get('song_id')
            if not song_id:
                continue
                
            # Initialize song features if not already present
            if song_id not in song_features:
                song_features[song_id] = {
                    'song_id': song_id,
                    'title': interaction.get('song_title', ''),
                    'artist': interaction.get('artist', ''),
                    'play_count': 0,
                    'favorite_count': 0,
                    'add_count': 0,
                    'remove_count': 0,
                    'rooms': set()
                }
            
            # Update feature counts based on action
            action = interaction.get('action')
            if action == 'play_song':
                song_features[song_id]['play_count'] += 1
            elif action == 'favorite_song':
                song_features[song_id]['favorite_count'] += 1
            elif action == 'add_song':
                song_features[song_id]['add_count'] += 1
            elif action == 'remove_song':
                song_features[song_id]['remove_count'] += 1
                
            # Add room to the set of rooms this song appears in
            if interaction.get('room_id'):
                song_features[song_id]['rooms'].add(interaction.get('room_id'))
        
        # Convert sets to lists for JSON serialization
        result = []
        for song_id, features in song_features.items():
            features['rooms'] = list(features['rooms'])
            features['room_count'] = len(features['rooms'])
            result.append(features)
            
        # If no data, return an empty list
        if not result:
            logger.warning("No song features found in the database")
            # Add a sample song for testing if needed
            if 'TESTING' in os.environ:
                result.append({
                    'song_id': 'sample_song_1',
                    'title': 'Sample Song',
                    'artist': 'Sample Artist',
                    'play_count': 10,
                    'favorite_count': 5,
                    'add_count': 3,
                    'remove_count': 1,
                    'rooms': ['sample_room_1', 'sample_room_2'],
                    'room_count': 2
                })
            
        return result
    except Exception as e:
        logger.error(f"Error exporting song features: {str(e)}")
        return []

def export_room_features():
    """
    Export room features by aggregating data from user logs.
    
    Returns:
        list: List of dictionaries with room features
    """
    try:
        # Get all room interactions
        room_interactions = export_user_room_interactions()
        
        # Extract unique rooms and their features
        room_features = {}
        
        for interaction in room_interactions:
            room_id = interaction.get('room_id')
            if not room_id:
                continue
                
            # Initialize room features if not already present
            if room_id not in room_features:
                room_features[room_id] = {
                    'room_id': room_id,
                    'join_count': 0,
                    'favorite_count': 0,
                    'create_count': 0,
                    'users': set()
                }
            
            # Update feature counts based on action
            action = interaction.get('action')
            if action == 'join_room':
                room_features[room_id]['join_count'] += 1
            elif action == 'favorite_room':
                room_features[room_id]['favorite_count'] += 1
            elif action == 'create_room':
                room_features[room_id]['create_count'] += 1
                
            # Add user to the set of users who interacted with this room
            if interaction.get('user_id'):
                room_features[room_id]['users'].add(interaction.get('user_id'))
        
        # Convert sets to lists for JSON serialization
        result = []
        for room_id, features in room_features.items():
            features['users'] = list(features['users'])
            features['user_count'] = len(features['users'])
            result.append(features)
            
        # If no data, return an empty list
        if not result:
            logger.warning("No room features found in the database")
            # Add a sample room for testing if needed
            if 'TESTING' in os.environ:
                result.append({
                    'room_id': 'sample_room_1',
                    'join_count': 15,
                    'favorite_count': 7,
                    'create_count': 1,
                    'users': ['user1', 'user2', 'user3'],
                    'user_count': 3
                })
            
        return result
    except Exception as e:
        logger.error(f"Error exporting room features: {str(e)}")
        return []

def export_recommendation_dataset(format='csv', output_dir=None):
    """
    Export a complete dataset for training recommendation systems.
    
    Args:
        format: Output format ('csv' or 'json')
        output_dir: Directory to save files (if None, returns data without saving)
    
    Returns:
        dict: Dictionary containing all datasets
    """
    try:
        # Get all interaction data
        song_interactions = export_user_song_interactions()
        room_interactions = export_user_room_interactions()
        song_features = export_song_features()
        room_features = export_room_features()
        
        # Prepare dataset
        dataset = {
            'song_interactions': song_interactions,
            'room_interactions': room_interactions,
            'song_features': song_features,
            'room_features': room_features
        }
        
        # Save to files if output_dir is provided
        if output_dir:
            import os
            import csv
            import pandas as pd
            
            os.makedirs(output_dir, exist_ok=True)
            
            if format == 'csv':
                # Save as CSV files
                for name, data in dataset.items():
                    if data:  # Only save if there's data
                        df = pd.DataFrame(data)
                        df.to_csv(os.path.join(output_dir, f"{name}.csv"), index=False)
            else:
                # Save as JSON files
                for name, data in dataset.items():
                    with open(os.path.join(output_dir, f"{name}.json"), 'w') as f:
                        json.dump(data, f, indent=2)
        
        return dataset
    except Exception as e:
        logger.error(f"Error exporting recommendation dataset: {str(e)}")
        return {}
