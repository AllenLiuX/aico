from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import util.gpt as gpt 
import util.llm_modules as llm
from pathlib import Path
# import spotify
import time
import logging
import util.youtube_music as youtube_music
import util.redis_api as redis_api
from datetime import datetime
from placeholder import init_placeholder_routes

from io import BytesIO
import random

# Import the example prompts
from data.example_prompts import EXAMPLE_PROMPTS

import hashlib
import secrets
from util.redis_api import *

import redis
import json

from util.generation import *
from util.all_utils import *

import util.lyrics as lyrics_api
from util.lyrics import fetch_lyrics

import os
from werkzeug.utils import secure_filename
from PIL import Image
import io
import uuid
from datetime import datetime
from flask_socketio import SocketIO, emit, join_room, leave_room
import eventlet

log_path = Path(__file__).parent.parent / "logs" / "backend.online.log"
logger_setup(log_path=log_path, debug=True)
logger = logging.getLogger(__name__)


redis_client = redis.Redis(host='localhost', port=6379, db=0)

redis_version = '_v1'

app = Flask(__name__)

# Configure upload folder
AVATARS_DIR = Path(__file__).parent / 'avatars'
AVATARS_DIR.mkdir(exist_ok=True)
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# Initialize placeholder routes
init_placeholder_routes(app)

# CORS(app)
# CORS(app, resources={r"/api/*": {"origins": "*"}})  # Enable CORS for all API routes
CORS(app, resources={r"/*": {"origins": "*"}})  # 允许所有域访问



# Define base paths
BASE_DIR = Path(__file__).parent.parent  # This gets you to aico/
FRONTEND_DIR = BASE_DIR / 'frontend' / 'react_dj'
STATIC_DIR = FRONTEND_DIR / 'public' / 'static'
AVATARS_DIR = STATIC_DIR / 'avatars'

# Create directories if they don't exist
AVATARS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
# Initialize SocketIO with Flask app
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Store room player state
# Store room player state
room_player_states = {}

@socketio.on('connect')
def handle_connect():
    logger.info(f"Client connected: {request.sid}")
    
@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"Client disconnected: {request.sid}")

@socketio.on('join_room')
def handle_join_room(data):
    room_name = data.get('room_name')
    is_host = data.get('is_host', False)
    username = data.get('username', 'Guest')
    
    logger.info(f"User {username} joining room {room_name}, is_host: {is_host}")
    
    # Join the socket room
    join_room(room_name)
    
    # Let the room know someone joined
    emit('user_joined', {
        'username': username,
        'is_host': is_host,
        'message': f"{username} joined the room"
    }, room=room_name)
    
    # Send current player state to the joining client if exists
    if room_name in room_player_states:
        emit('player_state_update', room_player_states[room_name])

@socketio.on('leave_room')
def handle_leave_room(data):
    room_name = data.get('room_name')
    username = data.get('username', 'Guest')
    logger.info(f"User {username} leaving room {room_name}")
    
    leave_room(room_name)
    emit('user_left', {
        'username': username,
        'message': f"{username} left the room"
    }, room=room_name)

@socketio.on('player_state_change')
def handle_player_state_change(data):
    room_name = data.get('room_name')
    is_host = data.get('is_host', False)
    player_state = data.get('player_state', {})
    
    # Only hosts can update player state
    if not is_host:
        return
    
    # Add a server timestamp to the state
    player_state['server_timestamp'] = time.time()
    
    logger.info(f"Host updated player state in room {room_name}: {player_state}")
    
    # Store the current state
    if room_name not in room_player_states:
        room_player_states[room_name] = {}
    
    # Update only the fields provided in the new state
    # This ensures we don't lose other state information
    room_player_states[room_name].update(player_state)
    
    # Broadcast to all clients in the room
    emit('player_state_update', room_player_states[room_name], room=room_name)

# Add API endpoint to get current player state
@app.route('/api/room/player-state', methods=['GET'])
def get_player_state():
    room_name = request.args.get('room_name')
    if not room_name or room_name not in room_player_states:
        return jsonify({"error": "Room not found or no player state available"}), 404
        
    return jsonify(room_player_states[room_name])

# if not os.path.exists(UPLOAD_FOLDER):
#     os.makedirs(UPLOAD_FOLDER)

# Update to the generate-playlist endpoint in app.py

def deduplicate_playlist(existing_playlist, new_playlist):
    """
    Deduplicate songs when appending to an existing playlist.
    
    Args:
        existing_playlist: List of existing song dictionaries
        new_playlist: List of new song dictionaries to append
        
    Returns:
        tuple: (deduplicated_new_playlist, combined_playlist)
    """
    # Create a set of existing song IDs for quick lookup
    existing_ids = set()
    for song in existing_playlist:
        # Use song_id as the unique identifier if available
        if 'song_id' in song:
            existing_ids.add(song['song_id'])
        # Fallback to title + artist if song_id is not available
        elif 'title' in song and 'artist' in song:
            existing_ids.add(f"{song['title']}:{song['artist']}")
    
    # Filter out duplicates from the new playlist
    deduplicated_new_playlist = []
    for song in new_playlist:
        # Check if song is already in existing playlist
        is_duplicate = False
        if 'song_id' in song and song['song_id'] in existing_ids:
            is_duplicate = True
        elif 'title' in song and 'artist' in song and f"{song['title']}:{song['artist']}" in existing_ids:
            is_duplicate = True
        
        # Add to deduplicated list if not a duplicate
        if not is_duplicate:
            deduplicated_new_playlist.append(song)
            # Add to existing_ids to prevent duplicates within new_playlist
            if 'song_id' in song:
                existing_ids.add(song['song_id'])
            elif 'title' in song and 'artist' in song:
                existing_ids.add(f"{song['title']}:{song['artist']}")
    
    # Combine playlists
    combined_playlist = existing_playlist + deduplicated_new_playlist
    
    return deduplicated_new_playlist, combined_playlist

@app.route('/api/generate-playlist', methods=['POST'])
def generate_playlist():
    data = request.json
    prompt = data.get('prompt')
    genre = data.get('genre')
    occasion = data.get('occasion')
    room_name = data.get('room_name')
    song_count = data.get('song_count', 20)  # Default to 20 if not provided
    append_to_room = data.get('append_to_room', False)  # New parameter to handle append mode
    moderation = data.get('moderation', 'no')  # Get moderation setting from request
    
    # Validate song count
    if not isinstance(song_count, int) or song_count <= 0:
        song_count = 20  # Fallback to default if invalid
    
    # Limit song count to reasonable range
    song_count = min(max(song_count, 10), 40)
    
    auth_token = request.headers.get('Authorization')
    
    # Get user information if logged in
    username = None
    avatar = None
    if auth_token:
        username = get_hash(f"sessions{redis_version}", auth_token)
        if username:
            profile_json = get_hash(f"user_profiles{redis_version}", username)
            if profile_json:
                profile = json.loads(profile_json)
                avatar = profile.get('avatar')

    try:
        logger.info(str(prompt))
        logger.info(str(genre))
        logger.info(str(occasion))
        logger.info(str(room_name))
        logger.info(f"Song count: {song_count}")
        logger.info(f"Append mode: {append_to_room}")
        logger.info(f"Moderation: {moderation}")

        settings = {
            "prompt": prompt,
            "genre": genre,
            "occasion": occasion,
            "song_count": song_count,
            "moderation_enabled": moderation == 'yes'  # Convert string to boolean
        }

        titles, artists, introduction, reply = llm.llm_generate_playlist(prompt, genre, occasion, song_count)
        
        new_playlist = []
        
        for title, artist in zip(titles, artists):
            try:
                logger.info(f'getting links for {title}...')
                song_info = youtube_music.get_song_info(song_name=title, artist_name=artist)
                new_playlist.append(song_info)

            except Exception as e:
                logger.info(f'----failed for {title}, {artist}', e)
        
        logger.info(str(new_playlist))

        # If append mode is enabled and room exists, append to existing playlist
        if append_to_room:
            existing_playlist_json = redis_api.get_hash(f"room_playlists{redis_version}", room_name)
            if existing_playlist_json:
                try:
                    existing_playlist = json.loads(existing_playlist_json)
                    
                    # Deduplicate the playlist
                    deduplicated_new_playlist, combined_playlist = deduplicate_playlist(existing_playlist, new_playlist)
                    
                    # Update the playlist in Redis
                    redis_api.write_hash(f"room_playlists{redis_version}", room_name, json.dumps(combined_playlist))
                    
                    # Return the deduplicated new playlist and combined length
                    return jsonify({
                        "playlist": deduplicated_new_playlist, 
                        "combined_playlist_length": len(combined_playlist),
                        "duplicates_removed": len(new_playlist) - len(deduplicated_new_playlist)
                    })
                except Exception as e:
                    logger.error(f"Error appending to playlist: {str(e)}")
                    # If there's an error, fall back to just returning the new playlist
        
        # If not in append mode or append failed, write the new playlist
        redis_api.write_hash(f"room_playlists{redis_version}", room_name, json.dumps(new_playlist))
        redis_api.write_hash(f"settings{redis_version}", room_name, json.dumps(settings))
        redis_api.write_hash(f"intro{redis_version}", room_name, introduction)
        
        # Store host information if user is logged in
        if username and avatar:
            set_room_host(room_name, username, avatar, update_timestamp=False)
            add_room_to_user_profile(username, room_name)

        return jsonify({"playlist": new_playlist})
    except Exception as e:
        logger.error(f"Error generating playlist: {str(e)}")
        return jsonify({"error": "Failed to generate playlist"}), 500

@app.route('/api/room-playlist', methods=['GET'])
def get_room_playlist():
    room_name = request.args.get('room_name')

    # Sanitize room name for file path (replace slashes and other unsafe characters)
    safe_room_name = room_name.replace('/', '_').replace('\\', '_')
    
    # Only generate QR code if it doesn't exist
    qr_code_path = Path(__file__).parent.parent / 'frontend' / 'react_dj' / 'public' / 'images' / f"qr_code_{safe_room_name}.png"
    if not qr_code_path.exists():
        # Create images directory if it doesn't exist
        qr_code_path.parent.mkdir(parents=True, exist_ok=True)
        generate_qr_code_with_logo(f'http://aico-music.com/playroom?room_name={room_name}', qr_code_path)
        
        build_path = Path(__file__).parent.parent / 'frontend' / 'react_dj' / 'build' / 'images' / f"qr_code_{safe_room_name}.png"
        build_path.parent.mkdir(parents=True, exist_ok=True)
        generate_qr_code_with_logo(f'http://aico-music.com/playroom?room_name={room_name}', build_path)

    try:
        # Get existing playlist data
        playlist = json.loads(get_hash(f"room_playlists{redis_version}", room_name))
        settings = json.loads(get_hash(f"settings{redis_version}", room_name))
        introduction = get_hash(f"intro{redis_version}", room_name)

        # Get host information
        host_data = get_room_host(room_name)
        
        return jsonify({
            "playlist": playlist,
            "introduction": introduction,
            "settings": settings,
            "host": host_data  # Add host information to response
        })
    except Exception as e:
        logger.error(f"Error fetching room data: {str(e)}")
        return jsonify({"error": "Failed to fetch room data"}), 500

    # playlist = [
    #     {"id": "spotify:track:1234", "title": "Song 1", "artist": "Artist 1"},
    #     {"id": "spotify:track:5678", "title": "Song 2", "artist": "Artist 2"},
    #     {"id": "spotify:track:9101", "title": "Song 3", "artist": "Artist 3"},
    # ]
    # return jsonify({"playlist": playlist, "introduction": introduction, "settings": settings})
    

@app.route('/api/search-music', methods=['GET'])
def search_music():
    query = request.args.get('query')
    search_type = request.args.get('search_type')

    logger.info(f'query:{query}; search_type:{search_type}')
    # tracks, json_result = spotify.search_spotify(query)

    # # Get the first 30 tracks from the search results, each track should have title, artist, url, id, image url
    # tracks = tracks[:30]

    # # Extract required information for each track
    # results = [{
    #     "title": track.get('name'),
    #     "artist": track['artists'][0]['name'] if track.get('artists') else "Unknown Artist",
    #     "url": track['external_urls']['spotify'] if track.get('external_urls') else "",
    #     "id": track.get('id'),
    #     "image_url": track['album']['images'][0]['url'] if track.get('album') and track['album'].get('images') else ""
    # } for track in tracks]
    
    # logger.info(str(results))

    if search_type == 'artist':
        results = youtube_music.search_artist_tracks(query, max_results=50)
    else:
        results = youtube_music.search_song_tracks(query, max_results=30)
        
    tracks = []
    for result in results:
        # track = {
        #         "id": result["song_id"],
        #         "title": result["title"],
        #         "url": result["song_url"],
        #         "image_url": result["cover_img_url"],
        #         "artist": result["artist"],
        #         "album": result["album"],
        #         "duration_seconds": result["duration_seconds"],
        #     }
        # tracks.append(track)
        tracks.append(result)

    logger.info(f"{tracks}")
    return jsonify({"tracks": tracks})


@app.route('/api/add-to-playlist', methods=['POST'])
def add_to_playlist():
    data = request.json
    room_name = data.get('room_name')
    track = data.get('track')

    # Fetch the existing playlist for the given room_name from Redis
    # playlist_json = redis_client.get(f"playlist:{room_name}")

    # if playlist_json:
    #     playlist = json.loads(playlist_json.decode('utf-8'))
    # else:
    #     playlist = []

    playlist = json.loads(redis_api.get_hash(f"room_playlists{redis_version}", room_name))

    # Add the new track to the playlist
    playlist.append(track)
    logger.info(f'added track:{track} in room:{room_name}')
    logger.info(f'new playlist:{playlist}')

    # Update the playlist in Redis
    # redis_client.set(f"playlist:{room_name}", json.dumps(playlist))
    
    redis_api.write_hash(f"room_playlists{redis_version}", room_name, json.dumps(playlist))


    return jsonify({"message": "Track added successfully"})

@app.route('/api/remove-from-playlist', methods=['POST'])
def remove_from_playlist():
    data = request.json
    room_name = data.get('room_name')
    track_id = data.get('track_id')

    # Fetch the existing playlist for the given room_name
    playlist = json.loads(redis_api.get_hash(f"room_playlists{redis_version}", room_name))

    # Find and remove the track with the matching song_id instead of id
    updated_playlist = [track for track in playlist if track.get('song_id') != track_id]
    
    # Log the removal operation
    logger.info(f'removed track with song_id:{track_id} from room:{room_name}')
    logger.info(f'new playlist:{updated_playlist}')

    # Update the playlist in Redis
    redis_api.write_hash(f"room_playlists{redis_version}", room_name, json.dumps(updated_playlist))

    return jsonify({"message": "Track removed successfully", "playlist": updated_playlist})

# Redis hash structure:
# users:{version} -> Hash containing username -> password_hash mappings
# user_profiles:{version} -> Hash containing username -> profile_json mappings
# sessions:{version} -> Hash containing session_token -> username mappings

redis_version = '_v1'

def hash_password(password):
    """Hash a password for storing."""
    return hashlib.sha256(password.encode()).hexdigest()

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')
    
    if not all([username, password]):
        return jsonify({"error": "Missing required fields"}), 400
    
    # Check if username exists
    if get_hash(f"users{redis_version}", username):
        return jsonify({"error": "Username already exists"}), 409
    
    # Hash password and store user data
    password_hash = hash_password(password)
    write_hash(f"users{redis_version}", username, password_hash)
    
    # Create avatar URL
    avatar_url = f"/api/avatars/{username}"
    
    # Store user profile
    profile = {
        "username": username,
        "email": email,
        "created_at": datetime.now().isoformat(),
        "avatar": avatar_url
    }
    write_hash(f"user_profiles{redis_version}", username, json.dumps(profile))
    
    # Generate session token
    session_token = secrets.token_urlsafe(32)
    write_hash(f"sessions{redis_version}", session_token, username)
    
    return jsonify({
        "token": session_token,
        "user": profile
    }), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not all([username, password]):
        return jsonify({"error": "Missing credentials"}), 400
    
    # Get stored password hash
    stored_hash = get_hash(f"users{redis_version}", username)
    if not stored_hash:
        return jsonify({"error": "Invalid username or password"}), 401
    
    # Verify password
    if hash_password(password) != stored_hash:
        return jsonify({"error": "Invalid username or password"}), 401
    
    # Generate session token
    session_token = secrets.token_urlsafe(32)
    write_hash(f"sessions{redis_version}", session_token, username)
    
    # Get user profile or create default one
    profile_json = get_hash(f"user_profiles{redis_version}", username)
    if profile_json:
        profile = json.loads(profile_json)
    else:
        # Create default profile with avatar
        avatar_url = f"/api/avatars/{username}"
        profile = {
            "username": username,
            "avatar": avatar_url
        }
        write_hash(f"user_profiles{redis_version}", username, json.dumps(profile))
    
    return jsonify({
        "token": session_token,
        "user": profile
    }), 200


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    auth_token = request.headers.get('Authorization')
    if auth_token:
        # Remove session
        delete_hash(f"sessions{redis_version}", auth_token)
    return jsonify({"message": "Logged out successfully"}), 200

@app.route('/api/auth/verify', methods=['GET'])
def verify_session():
    auth_token = request.headers.get('Authorization')
    if not auth_token:
        return jsonify({"error": "No token provided"}), 401
    
    username = get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return jsonify({"error": "Invalid or expired token"}), 401
    
    profile_json = get_hash(f"user_profiles{redis_version}", username)
    profile = json.loads(profile_json) if profile_json else {}
    
    return jsonify({
        "token": auth_token,
        "user": profile
    }), 200


def generate_avatar_svg(username):
    """Generate an SVG avatar with user's initials."""
    # Get first character of username (uppercase)
    initial = username[0].upper()
    
    # Generate a consistent color based on username
    random.seed(username)
    hue = random.randint(0, 360)
    
    # SVG template with the initial in the center
    svg = f'''
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
        <rect width="40" height="40" fill="hsl({hue}, 70%, 60%)" />
        <text x="20" y="24" fill="white" text-anchor="middle" 
              font-family="Arial, sans-serif" font-size="20" font-weight="bold">
            {initial}
        </text>
    </svg>
    '''
    return svg.strip()

@app.route('/api/avatar/<username>')
def get_avatar(username):
    svg = generate_avatar_svg(username)
    
    response = send_file(
        BytesIO(svg.encode()),
        mimetype='image/svg+xml'
    )
    
    # Set cache control headers manually
    response.headers['Cache-Control'] = 'public, max-age=86400'  # Cache for 24 hours
    return response


# Add these new Redis functions
def get_room_host(room_name):
    """Get room host information."""
    host_data = get_hash(f"room_hosts{redis_version}", room_name)
    if not host_data:
        return None
    return json.loads(host_data)

def set_room_host(room_name, username, avatar, update_timestamp=True):
    """Set or update the host information for a room.
    
    Args:
        room_name: The name of the room
        username: The username of the host
        avatar: The avatar URL of the host
        update_timestamp: Whether to update the created_at timestamp (default: True)
    """
    # Check if host data already exists
    existing_host_data_json = get_hash(f"room_hosts{redis_version}", room_name)
    
    if not update_timestamp and existing_host_data_json:
        # If we don't want to update the timestamp and host data exists,
        # preserve the existing created_at timestamp
        try:
            existing_host_data = json.loads(existing_host_data_json)
            created_at = existing_host_data.get('created_at', datetime.now().isoformat())
        except:
            # If there's an error parsing the existing data, use current time
            created_at = datetime.now().isoformat()
    else:
        # Otherwise, use current time
        created_at = datetime.now().isoformat()
    
    host_data = json.dumps({
        "username": username,
        "avatar": avatar,
        "created_at": created_at
    })
    write_hash(f"room_hosts{redis_version}", room_name, host_data)

def add_room_to_user_profile(username, room_name):
    """Add room to user's created rooms list."""
    profile_json = get_hash(f"user_profiles{redis_version}", username)
    if profile_json:
        profile = json.loads(profile_json)
        # Initialize created_rooms if it doesn't exist
        if 'created_rooms' not in profile:
            profile['created_rooms'] = []
        # Add room if not already in list
        if room_name not in profile['created_rooms']:
            profile['created_rooms'].append(room_name)
        write_hash(f"user_profiles{redis_version}", username, json.dumps(profile))


@app.route('/api/user/rooms', methods=['GET'])
def get_user_rooms():
    auth_token = request.headers.get('Authorization')
    if not auth_token:
        return jsonify({"error": "Authentication required"}), 401

    username = get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return jsonify({"error": "Invalid session"}), 401

    try:
        return get_user_rooms_helper(username)
        
    except Exception as e:
        logger.error(f"Error fetching user rooms: {str(e)}")
        return jsonify({"error": "Failed to fetch rooms"}), 500

def get_user_rooms_helper(username):
    # Get user profile to find created rooms
    profile_json = get_hash(f"user_profiles{redis_version}", username)
    if not profile_json:
        return jsonify({"rooms": []})
    
    profile = json.loads(profile_json)
    created_rooms = profile.get('created_rooms', [])
    
    rooms_data = []
    for room_name in created_rooms:
        # Get room data
        playlist_json = get_hash(f"room_playlists{redis_version}", room_name)
        settings_json = get_hash(f"settings{redis_version}", room_name)
        intro = get_hash(f"intro{redis_version}", room_name)
        
        if not playlist_json:
            continue  # Skip if room no longer exists
            
        playlist = json.loads(playlist_json)
        settings = json.loads(settings_json) if settings_json else {}
        
        # Get first song's cover image as room cover
        cover_image = playlist[0].get('cover_img_url', '') if playlist and len(playlist) > 0 else ''
        
        rooms_data.append({
            "name": room_name,
            "cover_image": cover_image,
            "introduction": intro[:100] + '...' if intro and len(intro) > 100 else intro,  # Cap description
            "song_count": len(playlist),
            "genre": settings.get('genre', ''),
            "occasion": settings.get('occasion', ''),
            "created_at": profile.get('created_at', '')
        })
        
    # Sort rooms by creation date, newest first
    rooms_data.sort(key=lambda x: x['created_at'], reverse=True)
    
    return jsonify({"rooms": rooms_data})

@app.route('/api/user/follow', methods=['POST'])
def follow_user():
    """Follow or unfollow a user"""
    auth_token = request.headers.get('Authorization')
    if not auth_token:
        return jsonify({"error": "Authentication required"}), 401

    username = get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return jsonify({"error": "Invalid session"}), 401

    try:
        data = request.json
        target_username = data.get('username')
        action = data.get('action')  # 'follow' or 'unfollow'

        if not target_username or action not in ['follow', 'unfollow']:
            return jsonify({"error": "Invalid request"}), 400

        # Get current following list
        following_json = get_hash(f"user_following{redis_version}", username)
        following = json.loads(following_json) if following_json else []

        # Get target's followers list
        followers_json = get_hash(f"user_followers{redis_version}", target_username)
        followers = json.loads(followers_json) if followers_json else []

        if action == 'follow':
            if target_username not in following:
                following.append(target_username)
            if username not in followers:
                followers.append(username)
        else:  # unfollow
            if target_username in following:
                following.remove(target_username)
            if username in followers:
                followers.remove(username)

        # Update Redis
        write_hash(f"user_following{redis_version}", username, json.dumps(following))
        write_hash(f"user_followers{redis_version}", target_username, json.dumps(followers))

        return jsonify({"message": f"Successfully {action}ed user"})

    except Exception as e:
        logger.error(f"Error in follow/unfollow: {str(e)}")
        return jsonify({"error": "Operation failed"}), 500

@app.route('/api/user/favorite', methods=['POST'])
def favorite_room():
    """Add or remove a room from user's favorites"""
    auth_token = request.headers.get('Authorization')
    if not auth_token:
        return jsonify({"error": "Authentication required"}), 401

    username = get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return jsonify({"error": "Invalid session"}), 401

    try:
        data = request.json
        room_name = data.get('room_name')
        action = data.get('action')  # 'add' or 'remove'

        if not room_name or action not in ['add', 'remove']:
            return jsonify({"error": "Invalid request"}), 400

        # Get current favorites list
        favorites_json = get_hash(f"user_favorites{redis_version}", username)
        favorites = json.loads(favorites_json) if favorites_json else []

        if action == 'add':
            if room_name not in favorites:
                favorites.append(room_name)
        else:  # remove
            if room_name in favorites:
                favorites.remove(room_name)

        # Update Redis
        write_hash(f"user_favorites{redis_version}", username, json.dumps(favorites))

        return jsonify({
            "message": f"Successfully {action}ed room to favorites"
        })

    except Exception as e:
        logger.error(f"Error in favorite operation: {str(e)}")
        return jsonify({"error": "Operation failed"}), 500


@app.route('/api/user/profile', methods=['GET'])
@app.route('/api/user/profile/<username>', methods=['GET'])
def get_user_profile(username=None):
    """Get user profile data including stats and tags"""
    # If username is provided, get public profile
    # If not, verify auth and get private profile
    if not username:
        auth_token = request.headers.get('Authorization')
        if not auth_token:
            return jsonify({"error": "Authentication required"}), 401

        username = get_hash(f"sessions{redis_version}", auth_token)
        if not username:
            return jsonify({"error": "Invalid session"}), 401

    try:
        # Get basic profile data
        profile_json = get_hash(f"user_profiles{redis_version}", username)
        if not profile_json:
            if username:  # For public profile requests
                return jsonify({"error": "User not found"}), 404
            # For authenticated requests, create default profile
            profile = format_user_profile(username)
        else:
            profile = json.loads(profile_json)

        # Get user rooms with details
        rooms_data = []
        created_rooms = profile.get('created_rooms', [])
        for room_name in created_rooms:
            # Get room data
            playlist_json = get_hash(f"room_playlists{redis_version}", room_name)
            settings_json = get_hash(f"settings{redis_version}", room_name)
            intro = get_hash(f"intro{redis_version}", room_name)
            
            if not playlist_json:
                continue  # Skip if room no longer exists
                
            playlist = json.loads(playlist_json)
            settings = json.loads(settings_json) if settings_json else {}
            
            # Get first song's cover image as room cover
            cover_image = playlist[0].get('cover_img_url', '') if playlist and len(playlist) > 0 else ''
            
            rooms_data.append({
                "name": room_name,
                "cover_image": cover_image,
                "introduction": intro[:100] + '...' if intro and len(intro) > 100 else intro,
                "song_count": len(playlist),
                "genre": settings.get('genre', ''),
                "occasion": settings.get('occasion', ''),
                "created_at": profile.get('created_at', '')
            })
        
        # Get favorites with details
        favorites_data = []
        favorites_json = get_hash(f"user_favorites{redis_version}", username)
        if favorites_json:
            favorites = json.loads(favorites_json)
            for room_name in favorites:
                try:
                    playlist_json = get_hash(f"room_playlists{redis_version}", room_name)
                    settings_json = get_hash(f"settings{redis_version}", room_name)
                    intro = get_hash(f"intro{redis_version}", room_name)
                    
                    if not playlist_json:
                        continue
                        
                    playlist = json.loads(playlist_json)
                    settings = json.loads(settings_json) if settings_json else {}
                    
                    cover_image = playlist[0].get('cover_img_url', '') if playlist and len(playlist) > 0 else ''
                    
                    favorites_data.append({
                        "name": room_name,
                        "cover_image": cover_image,
                        "introduction": intro[:100] + '...' if intro and len(intro) > 100 else intro,
                        "song_count": len(playlist),
                        "genre": settings.get('genre', ''),
                        "occasion": settings.get('occasion', '')
                    })
                except:
                    continue

        # Get following/followers with details
        following_data = []
        followers_data = []
        
        following_json = get_hash(f"user_following{redis_version}", username)
        followers_json = get_hash(f"user_followers{redis_version}", username)
        
        if following_json:
            following_usernames = json.loads(following_json)
            for follow_username in following_usernames:
                try:
                    follow_profile_json = get_hash(f"user_profiles{redis_version}", follow_username)
                    if follow_profile_json:
                        follow_profile = json.loads(follow_profile_json)
                        following_data.append({
                            "username": follow_username,
                            "avatar": follow_profile.get('avatar', f"/api/avatars/{follow_username}"),
                            "bio": follow_profile.get('bio', ''),
                            "country": follow_profile.get('country', '')
                        })
                except:
                    continue
        
        if followers_json:
            follower_usernames = json.loads(followers_json)
            for follower_username in follower_usernames:
                try:
                    follower_profile_json = get_hash(f"user_profiles{redis_version}", follower_username)
                    if follower_profile_json:
                        follower_profile = json.loads(follower_profile_json)
                        followers_data.append({
                            "username": follower_username,
                            "avatar": follower_profile.get('avatar', f"/api/avatars/{follower_username}"),
                            "bio": follower_profile.get('bio', ''),
                            "country": follower_profile.get('country', '')
                        })
                except:
                    continue

        # Get user tags
        user_tags_json = get_hash(f"user_tags{redis_version}", username)
        if user_tags_json:
            profile['tags'] = json.loads(user_tags_json)

        # Update stats
        profile["stats"] = {
            "rooms": len(rooms_data),
            "favorites": len(favorites_data),
            "following": len(following_data),
            "followers": len(followers_data)
        }

        # Include full data lists
        profile["rooms"] = rooms_data
        profile["favorites"] = favorites_data
        profile["following"] = following_data
        profile["followers"] = followers_data

        return jsonify(profile)

    except Exception as e:
        logger.error(f"Error fetching user profile for {username}: {str(e)}")
        return jsonify({"error": "Failed to fetch profile"}), 500

@app.route('/api/user/profile', methods=['POST'])
def update_user_profile():
    """Update user profile data including tags"""
    auth_token = request.headers.get('Authorization')
    if not auth_token:
        return jsonify({"error": "Authentication required"}), 401

    username = get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return jsonify({"error": "Invalid session"}), 401

    try:
        # Get update data
        update_data = request.json
        
        # Get existing profile
        profile_json = get_hash(f"user_profiles{redis_version}", username)
        profile = json.loads(profile_json) if profile_json else format_user_profile(username)
        
        # Update allowed fields
        allowed_fields = ['age', 'country', 'sex', 'bio', 'email']
        for field in allowed_fields:
            if field in update_data:
                profile[field] = update_data[field]
        
        # Update tags separately
        if 'tags' in update_data:
            write_hash(f"user_tags{redis_version}", username, json.dumps(update_data['tags']))
            profile['tags'] = update_data['tags']
        
        # Save updated profile
        write_hash(f"user_profiles{redis_version}", username, json.dumps(profile))
        
        return jsonify({
            "message": "Profile updated successfully",
            "profile": profile
        })

    except Exception as e:
        logger.error(f"Error updating user profile: {str(e)}")
        return jsonify({"error": "Failed to update profile"}), 500

# Add Tag-related endpoints if needed

@app.route('/api/tags/suggestions', methods=['GET'])
def get_tag_suggestions():
    """Get tag suggestions based on category"""
    category = request.args.get('category', 'all')
    
    suggestions = {
        'genres': ['Pop', 'Rock', 'Hip Hop', 'Jazz', 'Classical', 'Electronic', 'R&B', 'Country', 'Folk', 'Metal', 'Blues', 'Reggae', 'Soul', 'Funk', 'Indie'],
        'languages': ['English', 'Chinese', 'Spanish', 'Japanese', 'Korean', 'French', 'German', 'Italian', 'Portuguese', 'Russian'],
        'styles': ['Dance', 'Acoustic', 'Instrumental', 'Vocal', 'Live', 'Studio', 'Remix', 'Cover', 'Original', 'Experimental'],
        'artists': ['Taylor Swift', 'Ed Sheeran', 'Drake', 'BTS', 'The Weeknd', 'Beyoncé', 'Adele', 'Jay Chou', 'Eason Chan', 'BLACKPINK']
    }
    
    if category == 'all':
        return jsonify(suggestions)
    
    return jsonify({category: suggestions.get(category, [])})


@app.route('/api/explore/rooms', methods=['GET'])
def get_explore_rooms():
    """Get paginated list of all rooms, sorted by created_at timestamp (newest first)"""
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 12))
        offset = (page - 1) * limit

        # Get all rooms and their playlists
        all_rooms = get_all_hash(f"room_playlists{redis_version}")
        
        all_room_names = list(all_rooms.keys())
        logger.info(f"all_room_names:{all_room_names}")
        total_rooms = len(all_room_names)

        # Collect all room data with their creation timestamps
        room_data_list = []
        for room_name in all_room_names:
            try:
                # Get playlist data
                playlist = json.loads(all_rooms[room_name])
                
                # Get additional room data
                settings_json = get_hash(f"settings{redis_version}", room_name)
                intro = get_hash(f"intro{redis_version}", room_name)
                host_data = get_room_host(room_name)

                settings = json.loads(settings_json) if settings_json else {}
                
                # Get first song's cover image as room cover
                cover_image = playlist[0].get('cover_img_url', '') if playlist and len(playlist) > 0 else ''
                
                # Get created_at timestamp (default to oldest possible date if not available)
                created_at = None
                if host_data and 'created_at' in host_data:
                    created_at = host_data['created_at']
                else:
                    # Use a very old date as default for sorting
                    created_at = "1970-01-01T00:00:00"

                room_data = {
                    "name": room_name,
                    "cover_image": cover_image,
                    "introduction": intro,
                    "song_count": len(playlist),
                    "genre": settings.get('genre', ''),
                    "occasion": settings.get('occasion', ''),
                    "host": host_data,
                    "created_at": created_at  # Add created_at for sorting
                }
                room_data_list.append(room_data)
            except Exception as e:
                logger.error(f"Error processing room {room_name}: {str(e)}")
                continue

        # Sort rooms by created_at (newest first)
        sorted_rooms = sorted(room_data_list, key=lambda x: x['created_at'], reverse=True)
        
        # Apply pagination after sorting
        paginated_rooms = sorted_rooms[offset:offset + limit]
        
        # Remove the created_at field from the response (it's already in host data)
        for room in paginated_rooms:
            if 'created_at' in room:
                del room['created_at']

        res = {
            "rooms": paginated_rooms,
            "total": total_rooms,
            "hasMore": offset + limit < total_rooms
        }
        logger.info(str(res))
        return jsonify({
            "rooms": paginated_rooms,
            "total": total_rooms,
            "hasMore": offset + limit < total_rooms
        })
    except Exception as e:
        logger.error(f"Error fetching explore rooms: {str(e)}")
        return jsonify({"error": "Failed to fetch rooms"}), 500

@app.route('/api/user/avatar', methods=['POST'])
def upload_avatar():
    auth_token = request.headers.get('Authorization')
    if not auth_token:
        return jsonify({"error": "Authentication required"}), 401

    username = get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return jsonify({"error": "Invalid session"}), 401

    if 'avatar' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['avatar']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Invalid file type"}), 400

    try:
        # Process and save image
        image = Image.open(file)
        
        # Resize to standard size
        image.thumbnail((400, 400))
        
        # Convert to RGB if necessary
        if image.mode in ('RGBA', 'P'):
            image = image.convert('RGB')
        
        # Generate unique filename
        filename = f"{username}_{int(time.time())}.jpg"
        filepath = AVATARS_DIR / filename
        logger.info(f'saving avatar for {username} at {filepath}')
        
        # Save optimized image
        image.save(str(filepath), 'JPEG', quality=85, optimize=True)
        
        # Update URL format to be absolute path from API root
        avatar_url = f"/api/avatars/{filename}"
        
        # Update user profile in Redis
        profile_json = get_hash(f"user_profiles{redis_version}", username)
        profile = json.loads(profile_json) if profile_json else {}
        profile['avatar'] = avatar_url
        write_hash(f"user_profiles{redis_version}", username, json.dumps(profile))
        
        # Also update any rooms where this user is a host
        user_rooms_response = get_user_rooms_helper(username)
        rooms = user_rooms_response.json['rooms']
        for room in rooms:
            host_data = get_room_host(room['name'])
            if host_data and host_data.get('username') == username:
                set_room_host(room['name'], username, avatar_url, update_timestamp=False)
        
        return jsonify({
            "message": "Avatar uploaded successfully",
            "avatar_url": avatar_url
        })
    except Exception as e:
        logger.error(f"Error uploading avatar: {str(e)}")
        return jsonify({"error": "Failed to process image"}), 500

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Add route to serve static files (if needed)
@app.route('/api/avatars/<path:filename>')
def serve_avatar(filename):
    try:
        if not os.path.exists(AVATARS_DIR / filename):
            logger.warning(f"Avatar file not found: {filename}")
            return jsonify({"error": "Avatar not found"}), 404
            
        response = send_from_directory(str(AVATARS_DIR), filename)
        response.headers['Cache-Control'] = 'public, max-age=31536000'
        return response
    except Exception as e:
        logger.error(f"Error serving avatar {filename}: {str(e)}")
        return jsonify({"error": "Failed to serve avatar"}), 500

# Update the existing request-track endpoint in app.py

@app.route('/api/request-track', methods=['POST'])
def request_track():
    """
    Non-host users can request tracks to be added to a room's playlist
    With moderation toggle: tracks go directly to playlist when moderation is off
    """
    data = request.json
    room_name = data.get('room_name')
    track = data.get('track')
    auth_token = request.headers.get('Authorization')
    
    # Identify the requester
    username = None
    if auth_token:
        username = get_hash(f"sessions{redis_version}", auth_token)
    
    if not all([room_name, track]):
        logger.error(f"Missing required fields: room_name={room_name}, track={'present' if track else 'missing'}")
        return jsonify({"error": "Missing required fields"}), 400
        
    try:
        # Log the incoming request for debugging
        logger.info(f"Processing track request for room {room_name} by {username or 'Guest'}")
        logger.info(f"Track info: {json.dumps(track)}")
        
        # Check moderation setting
        settings_json = get_hash(f"settings{redis_version}", room_name)
        if not settings_json:
            logger.warning(f"No settings found for room {room_name}, using default moderation=True")
            settings = {}
        else:
            try:
                settings = json.loads(settings_json)
                logger.info(f"Loaded settings for room {room_name}: {settings}")
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON in settings for room {room_name}: {settings_json}")
                settings = {}
        
        # Important: Check specifically for moderation_enabled
        # Default to moderation enabled (true) if not specified for safety
        moderation_enabled = settings.get('moderation_enabled', True)
        
        logger.info(f"Moderation setting for room {room_name}: {moderation_enabled}")
        
        # Generate a unique request ID
        request_id = str(uuid.uuid4())
        track['request_id'] = request_id
        
        # Add requester info to the track
        track['requested_by'] = username if username else "Guest"
        track['requested_at'] = datetime.now().isoformat()
        
        # If moderation is off, add directly to playlist
        if not moderation_enabled:
            logger.info(f"Moderation is off, adding track directly to playlist for {room_name}")
            
            # Get existing playlist
            playlist_json = get_hash(f"room_playlists{redis_version}", room_name)
            if not playlist_json:
                logger.warning(f"No playlist found for room {room_name}, creating new playlist")
                playlist = []
            else:
                try:
                    playlist = json.loads(playlist_json)
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON in playlist for room {room_name}: {playlist_json}")
                    playlist = []
            
            # Add the track to the playlist
            playlist.append(track)
            
            # Update the playlist in Redis
            write_hash(f"room_playlists{redis_version}", room_name, json.dumps(playlist))
            
            logger.info(f"Track added directly to playlist for room {room_name} (moderation off)")
            
            return jsonify({
                "message": "Track added to playlist",
                "request_id": request_id,
                "moderated": False
            })
        
        # With moderation enabled, store as pending request
        logger.info(f"Moderation is on, adding track to pending requests for {room_name}")
        track['status'] = 'pending'
        
        # Convert track to JSON for storage
        track_json = json.dumps(track)
        
        # Store the request in Redis
        write_hash(f"track_requests{redis_version}", request_id, track_json)
        logger.info(f"Stored track request with ID {request_id} in track_requests{redis_version}")
        
        # Associate request with user if logged in
        if username:
            user_requests = get_hash(f"user_requests{redis_version}", username)
            if user_requests:
                try:
                    requests_list = json.loads(user_requests)
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON in user_requests for {username}: {user_requests}")
                    requests_list = []
            else:
                requests_list = []
            
            requests_list.append(request_id)
            write_hash(f"user_requests{redis_version}", username, json.dumps(requests_list))
            logger.info(f"Associated request {request_id} with user {username}")
        
        # Associate request with room
        room_requests = get_hash(f"room_requests{redis_version}", room_name)
        if room_requests:
            try:
                requests_list = json.loads(room_requests)
                logger.info(f"Found existing room requests for {room_name}: {requests_list}")
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON in room_requests for {room_name}: {room_requests}")
                requests_list = []
        else:
            logger.info(f"No existing room requests for {room_name}, creating new list")
            requests_list = []
        
        requests_list.append(request_id)
        write_hash(f"room_requests{redis_version}", room_name, json.dumps(requests_list))
        logger.info(f"Associated request {request_id} with room {room_name}, requests list now: {requests_list}")
        
        return jsonify({
            "message": "Track requested successfully",
            "request_id": request_id,
            "moderated": True
        })
    except Exception as e:
        logger.error(f"Error requesting track: {str(e)}")
        return jsonify({"error": "Failed to request track"}), 500


@app.route('/api/pending-requests', methods=['GET'])
def get_pending_requests():
    """Get all pending track requests for a room (host only)"""
    room_name = request.args.get('room_name')
    auth_token = request.headers.get('Authorization')
    
    if not room_name:
        logger.error("No room_name provided in get_pending_requests")
        return jsonify({"error": "Room name is required"}), 400
    
    logger.info(f"Fetching pending requests for room: {room_name}")
    
    # Verify if user is the host of the room
    is_host = False
    username = None
    
    if auth_token:
        username = get_hash(f"sessions{redis_version}", auth_token)
        logger.info(f"User {username} attempting to view pending requests")
        
        host_data = get_room_host(room_name)
        logger.info(f"Host data for room {room_name}: {host_data}")
        
        if host_data:
            try:
                # If host_data is already a dictionary, use it directly
                if isinstance(host_data, dict):
                    host_info = host_data
                # If it's a string (JSON), parse it
                else:
                    host_info = json.loads(host_data)
                
                logger.info(f"Host info: {host_info}")
                if host_info.get('username') == username:
                    is_host = True
                    logger.info(f"User {username} confirmed as host of room {room_name}")
            except Exception as e:
                logger.error(f"Error parsing host data: {str(e)}")
                logger.error(f"Host data type: {type(host_data)}")
                logger.error(f"Host data value: {host_data}")
    
    # For debugging purposes, temporarily bypass host check
    # Comment this out in production!
    if not is_host:
        logger.warning(f"Temporarily bypassing host check - user {username} is allowed to view pending requests")
        is_host = True
    
    if not is_host:
        logger.warning(f"User {username} denied access to pending requests - not the host")
        return jsonify({"error": "Only room hosts can view pending requests"}), 403
    
    try:
        # Get all request IDs for this room
        room_requests = get_hash(f"room_requests{redis_version}", room_name)
        logger.info(f"Room requests for {room_name}: {room_requests}")
        
        if not room_requests:
            logger.info(f"No pending requests found for room {room_name}")
            return jsonify({"requests": []})
        
        try:
            request_ids = json.loads(room_requests)
            logger.info(f"Request IDs: {request_ids}")
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON in room_requests: {room_requests}")
            return jsonify({"requests": [], "error": "Invalid data format"})
        
        pending_requests = []
        
        # Get each request's details and filter only pending ones
        for request_id in request_ids:
            logger.info(f"Processing request ID: {request_id}")
            request_data = get_hash(f"track_requests{redis_version}", request_id)
            
            if not request_data:
                logger.warning(f"No data found for request ID {request_id}")
                continue
                
            try:
                track = json.loads(request_data)
                logger.info(f"Track data for request {request_id}: status={track.get('status')}")
                
                if track.get('status') == 'pending':
                    pending_requests.append(track)
                    logger.info(f"Added pending request: {track.get('title')} by {track.get('artist')}")
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON in track request data: {request_data}")
        
        logger.info(f"Returning {len(pending_requests)} pending requests for room {room_name}")
        return jsonify({"requests": pending_requests})
    except Exception as e:
        logger.error(f"Error fetching pending requests: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Failed to fetch pending requests: {str(e)}"}), 500

@app.route('/api/approve-track-request', methods=['POST'])
def approve_track_request():
    """Approve a pending track request (host only)"""
    data = request.json
    room_name = data.get('room_name')
    track_id = data.get('track_id')
    request_id = data.get('request_id')
    requester_id = data.get('requester_id')
    
    if not all([room_name, request_id]):
        return jsonify({"error": "Missing required fields"}), 400
    
    try:
        # Get the request data
        request_data = get_hash(f"track_requests{redis_version}", request_id)
        if not request_data:
            return jsonify({"error": "Request not found"}), 404
        
        track = json.loads(request_data)
        
        # Update the request status
        track['status'] = 'approved'
        track['approved_at'] = datetime.now().isoformat()
        write_hash(f"track_requests{redis_version}", request_id, json.dumps(track))
        
        # Add the track to the room's playlist
        playlist = json.loads(get_hash(f"room_playlists{redis_version}", room_name))
        playlist.append(track)
        write_hash(f"room_playlists{redis_version}", room_name, json.dumps(playlist))
        
        # Create notification for the requester
        if requester_id and requester_id != "Guest":
            notification = {
                "type": "request_status",
                "status": "approved",
                "message": f"Your request for '{track.get('title')}' by {track.get('artist')} has been approved!",
                "track_title": track.get('title'),
                "track_artist": track.get('artist'),
                "timestamp": datetime.now().isoformat(),
                "read": False
            }
            
            notifications = get_hash(f"request_notifications{redis_version}", requester_id)
            if notifications:
                notifications_list = json.loads(notifications)
            else:
                notifications_list = []
                
            notifications_list.append(notification)
            write_hash(f"request_notifications{redis_version}", requester_id, json.dumps(notifications_list))
        
        return jsonify({
            "message": "Track request approved",
            "approved_track": track,
            "request_id": request_id
        })
    except Exception as e:
        logger.error(f"Error approving track request: {str(e)}")
        return jsonify({"error": "Failed to approve track request"}), 500


@app.route('/api/reject-track-request', methods=['POST'])
def reject_track_request():
    """Reject a pending track request (host only)"""
    data = request.json
    room_name = data.get('room_name')
    track_id = data.get('track_id')
    request_id = data.get('request_id')
    requester_id = data.get('requester_id')
    
    if not all([room_name, request_id]):
        return jsonify({"error": "Missing required fields"}), 400
    
    try:
        # Get the request data
        request_data = get_hash(f"track_requests{redis_version}", request_id)
        if not request_data:
            return jsonify({"error": "Request not found"}), 404
        
        track = json.loads(request_data)
        
        # Update the request status
        track['status'] = 'rejected'
        track['rejected_at'] = datetime.now().isoformat()
        write_hash(f"track_requests{redis_version}", request_id, json.dumps(track))
        
        # Create notification for the requester
        if requester_id and requester_id != "Guest":
            notification = {
                "type": "request_status",
                "status": "rejected",
                "message": f"Your request for '{track.get('title')}' by {track.get('artist')} was not approved.",
                "track_title": track.get('title'),
                "track_artist": track.get('artist'),
                "timestamp": datetime.now().isoformat(),
                "read": False
            }
            
            notifications = get_hash(f"request_notifications{redis_version}", requester_id)
            if notifications:
                notifications_list = json.loads(notifications)
            else:
                notifications_list = []
                
            notifications_list.append(notification)
            write_hash(f"request_notifications{redis_version}", requester_id, json.dumps(notifications_list))
        
        return jsonify({
            "message": "Track request rejected",
            "request_id": request_id
        })
    except Exception as e:
        logger.error(f"Error rejecting track request: {str(e)}")
        return jsonify({"error": "Failed to reject track request"}), 500


@app.route('/api/request-status', methods=['GET'])
def check_request_status():
    """Check status updates for a user's track requests"""
    room_name = request.args.get('room_name')
    auth_token = request.headers.get('Authorization')
    
    if not auth_token:
        return jsonify({"error": "Authentication required"}), 401
    
    username = get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return jsonify({"error": "Invalid session"}), 401
    
    try:
        # Get the user's notifications
        notifications = get_hash(f"request_notifications{redis_version}", username)
        if not notifications:
            return jsonify({"notifications": []})
        
        notifications_list = json.loads(notifications)
        
        # Filter unread notifications
        unread = [n for n in notifications_list if n.get('read') == False]
        
        # Mark these notifications as read
        for notification in notifications_list:
            notification['read'] = True
        
        write_hash(f"request_notifications{redis_version}", username, json.dumps(notifications_list))
        
        return jsonify({"notifications": unread})
    except Exception as e:
        logger.error(f"Error checking request status: {str(e)}")
        return jsonify({"error": "Failed to check request status"}), 500


# Add this to app.py
@app.route('/api/get-lyrics', methods=['GET'])
def get_lyrics():
    song_title = request.args.get('title')
    artist_name = request.args.get('artist')
    timestamps = request.args.get('timestamps', 'true').lower() == 'true'
    
    if not song_title or not artist_name:
        return jsonify({"error": "Song title and artist name are required"}), 400
    
    try:
        lyrics_data = fetch_lyrics(song_title, artist_name, include_timestamps=True)
        
        # Return different formats based on request
        if timestamps:
            return jsonify({
                "lyrics": lyrics_data['formatted_lyrics'],
                "rawLyrics": lyrics_data['raw_lyrics'],
                "timedLyrics": lyrics_data['timed_lyrics'],
                "source": lyrics_data['source']
            })
        else:
            return jsonify({"lyrics": lyrics_data['formatted_lyrics']})
    except Exception as e:
        logger.error(f"Error fetching lyrics: {str(e)}")
        return jsonify({"error": "Failed to fetch lyrics"}), 500


# Add this endpoint to app.py to support moderation toggle

@app.route('/api/room/update-moderation', methods=['POST'])
def update_room_moderation():
    data = request.json
    room_name = data.get('room_name')
    moderation_enabled = data.get('moderation_enabled', False)
    auth_token = request.headers.get('Authorization')
    
    # Verify if user is the host of the room
    if not room_name:
        return jsonify({"error": "Room name is required"}), 400
    
    username = None
    if auth_token:
        username = get_hash(f"sessions{redis_version}", auth_token)
    
    # Check if user is host
    host_data = get_room_host(room_name)
    is_host = False
    logger.info(f'host_data:{host_data}')
    
    if host_data and username:
        try:
            if isinstance(host_data, str):
                host_data = json.loads(host_data)
            
            if host_data.get('username') == username:
                is_host = True
        except Exception as e:
            logger.error(f"Error parsing host data: {str(e)}")
            pass
    
    if not is_host:
        return jsonify({"error": "Only room hosts can update moderation settings"}), 403
    
    try:
        # Get existing settings
        settings_json = get_hash(f"settings{redis_version}", room_name)
        settings = json.loads(settings_json) if settings_json else {}
        
        # Update moderation setting - Make sure it's using a boolean value
        settings['moderation_enabled'] = bool(moderation_enabled)
        
        # Save updated settings
        write_hash(f"settings{redis_version}", room_name, json.dumps(settings))
        
        logger.info(f"Updated moderation for room {room_name} to {moderation_enabled}")
        
        return jsonify({
            "message": "Moderation settings updated successfully",
            "moderation_enabled": moderation_enabled
        })
    
    except Exception as e:
        logger.error(f"Error updating moderation settings: {str(e)}")
        return jsonify({"error": "Failed to update moderation settings"}), 500

    
    # Add this endpoint to app.py to support playlist info editing

@app.route('/api/update-playlist-info', methods=['POST'])
def update_playlist_info():
    data = request.json
    room_name = data.get('room_name')
    introduction = data.get('introduction')
    auth_token = request.headers.get('Authorization')
    
    # Validate request
    if not room_name:
        return jsonify({"error": "Room name is required"}), 400
        
    if introduction is None:
        return jsonify({"error": "Introduction is required"}), 400
    
    # Verify if user is the host of the room
    username = None
    if auth_token:
        username = get_hash(f"sessions{redis_version}", auth_token)
    
    # Check if user is host
    host_data = get_room_host(room_name)
    is_host = False
    
    if host_data and username:
        try:
            host_info = json.loads(host_data)
            if host_info.get('username') == username:
                is_host = True
        except:
            pass
    
    if not is_host:
        return jsonify({"error": "Only room hosts can update playlist information"}), 403
    
    try:
        # Update the playlist introduction
        write_hash(f"intro{redis_version}", room_name, introduction)
        
        logger.info(f"Updated playlist info for room {room_name}")
        
        return jsonify({
            "message": "Playlist information updated successfully"
        })
    
    except Exception as e:
        logger.error(f"Error updating playlist info: {str(e)}")
        return jsonify({"error": "Failed to update playlist information"}), 500


# Add these endpoint functions to your app.py file

@app.route('/api/user/favorites', methods=['GET'])
def get_favorites():
    """Get user's favorite rooms"""
    auth_token = request.headers.get('Authorization')
    if not auth_token:
        return jsonify({"error": "Authentication required"}), 401

    username = get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return jsonify({"error": "Invalid session"}), 401

    try:
        # Get user's favorites list
        favorites_json = get_hash(f"user_favorites{redis_version}", username)
        favorites = json.loads(favorites_json) if favorites_json else []
        
        # Get details for each favorite room if requested
        detailed = request.args.get('detailed', 'false').lower() == 'true'
        
        if detailed:
            rooms_data = []
            for room_name in favorites:
                try:
                    # Get room data
                    playlist_json = get_hash(f"room_playlists{redis_version}", room_name)
                    settings_json = get_hash(f"settings{redis_version}", room_name)
                    intro = get_hash(f"intro{redis_version}", room_name)
                    
                    if not playlist_json:
                        continue  # Skip if room no longer exists
                        
                    playlist = json.loads(playlist_json)
                    settings = json.loads(settings_json) if settings_json else {}
                    
                    # Get first song's cover image as room cover
                    cover_image = playlist[0].get('cover_img_url', '') if playlist and len(playlist) > 0 else ''
                    
                    rooms_data.append({
                        "name": room_name,
                        "cover_image": cover_image,
                        "introduction": intro[:100] + '...' if intro and len(intro) > 100 else intro,
                        "song_count": len(playlist),
                        "genre": settings.get('genre', ''),
                        "occasion": settings.get('occasion', '')
                    })
                except Exception as e:
                    logger.error(f"Error getting favorite room details: {e}")
                    continue
            
            return jsonify({"favorites": favorites, "rooms": rooms_data})
        else:
            return jsonify({"favorites": favorites})
            
    except Exception as e:
        logger.error(f"Error fetching user favorites: {str(e)}")
        return jsonify({"error": "Failed to fetch favorites"}), 500

@app.route('/api/user/following', methods=['GET'])
def get_following():
    """Get list of users the current user is following"""
    auth_token = request.headers.get('Authorization')
    if not auth_token:
        return jsonify({"error": "Authentication required"}), 401

    username = get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return jsonify({"error": "Invalid session"}), 401

    try:
        # Get following list
        following_json = get_hash(f"user_following{redis_version}", username)
        following = json.loads(following_json) if following_json else []

        # Get details for each followed user if requested
        detailed = request.args.get('detailed', 'false').lower() == 'true'
        
        if detailed:
            users_data = []
            for followed_username in following:
                try:
                    profile_json = get_hash(f"user_profiles{redis_version}", followed_username)
                    if profile_json:
                        profile = json.loads(profile_json)
                        users_data.append({
                            "username": followed_username,
                            "avatar": profile.get('avatar', f"/api/avatars/{followed_username}"),
                            "bio": profile.get('bio', ''),
                            "country": profile.get('country', '')
                        })
                except Exception as e:
                    logger.error(f"Error getting followed user details: {e}")
                    continue
            
            return jsonify({"following": following, "users": users_data})
        else:
            return jsonify({"following": following})
            
    except Exception as e:
        logger.error(f"Error fetching followed users: {str(e)}")
        return jsonify({"error": "Failed to fetch followed users"}), 500

@app.route('/api/user/followers', methods=['GET'])
def get_followers():
    """Get list of users following the current user"""
    auth_token = request.headers.get('Authorization')
    if not auth_token:
        return jsonify({"error": "Authentication required"}), 401

    username = get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return jsonify({"error": "Invalid session"}), 401

    try:
        # Get followers list
        followers_json = get_hash(f"user_followers{redis_version}", username)
        followers = json.loads(followers_json) if followers_json else []
        
        # Get details for each follower if requested
        detailed = request.args.get('detailed', 'false').lower() == 'true'
        
        if detailed:
            users_data = []
            for follower_username in followers:
                try:
                    profile_json = get_hash(f"user_profiles{redis_version}", follower_username)
                    if profile_json:
                        profile = json.loads(profile_json)
                        users_data.append({
                            "username": follower_username,
                            "avatar": profile.get('avatar', f"/api/avatars/{follower_username}"),
                            "bio": profile.get('bio', ''),
                            "country": profile.get('country', '')
                        })
                except Exception as e:
                    logger.error(f"Error getting follower details: {e}")
                    continue
            
            return jsonify({"followers": followers, "users": users_data})
        else:
            return jsonify({"followers": followers})
            
    except Exception as e:
        logger.error(f"Error fetching followers: {str(e)}")
        return jsonify({"error": "Failed to fetch followers"}), 500

# Make sure the follow endpoint works for both follow and unfollow actions
@app.route('/api/user/follow', methods=['POST'])
def toggle_follow_user():
    """Follow or unfollow a user"""
    auth_token = request.headers.get('Authorization')
    if not auth_token:
        return jsonify({"error": "Authentication required"}), 401

    username = get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return jsonify({"error": "Invalid session"}), 401

    try:
        data = request.json
        target_username = data.get('username')
        action = data.get('action')  # 'follow' or 'unfollow'

        if not target_username or action not in ['follow', 'unfollow']:
            return jsonify({"error": "Invalid request"}), 400
            
        # Prevent following yourself
        if username == target_username:
            return jsonify({"error": "You cannot follow yourself"}), 400

        # Get current following list for the user
        following_json = get_hash(f"user_following{redis_version}", username)
        following = json.loads(following_json) if following_json else []

        # Get followers list for the target user
        followers_json = get_hash(f"user_followers{redis_version}", target_username)
        followers = json.loads(followers_json) if followers_json else []

        if action == 'follow':
            # Add target to user's following list if not already there
            if target_username not in following:
                following.append(target_username)
                
            # Add user to target's followers list if not already there
            if username not in followers:
                followers.append(username)
                
        else:  # unfollow
            # Remove target from user's following list
            if target_username in following:
                following.remove(target_username)
                
            # Remove user from target's followers list
            if username in followers:
                followers.remove(username)

        # Update Redis
        write_hash(f"user_following{redis_version}", username, json.dumps(following))
        write_hash(f"user_followers{redis_version}", target_username, json.dumps(followers))

        return jsonify({"message": f"Successfully {action}ed user", "following": following})

    except Exception as e:
        logger.error(f"Error in follow/unfollow: {str(e)}")
        return jsonify({"error": "Operation failed"}), 500

# Update the existing favorite endpoint to ensure it's working correctly
@app.route('/api/user/favorite', methods=['POST'])
def toggle_favorite_room():
    """Add or remove a room from user's favorites"""
    auth_token = request.headers.get('Authorization')
    if not auth_token:
        return jsonify({"error": "Authentication required"}), 401

    username = get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return jsonify({"error": "Invalid session"}), 401

    try:
        data = request.json
        room_name = data.get('room_name')
        action = data.get('action')  # 'add' or 'remove'

        if not room_name or action not in ['add', 'remove']:
            return jsonify({"error": "Invalid request"}), 400

        # Get current favorites list
        favorites_json = get_hash(f"user_favorites{redis_version}", username)
        favorites = json.loads(favorites_json) if favorites_json else []

        if action == 'add':
            # Add room to favorites if not already there
            if room_name not in favorites:
                favorites.append(room_name)
        else:  # remove
            # Remove room from favorites
            if room_name in favorites:
                favorites.remove(room_name)

        # Update Redis
        write_hash(f"user_favorites{redis_version}", username, json.dumps(favorites))

        # Also update user profile stats
        profile_json = get_hash(f"user_profiles{redis_version}", username)
        if profile_json:
            profile = json.loads(profile_json)
            if 'stats' not in profile:
                profile['stats'] = {}
            profile['stats']['favorites'] = len(favorites)
            write_hash(f"user_profiles{redis_version}", username, json.dumps(profile))

        return jsonify({
            "message": f"Successfully {action}ed room to favorites", 
            "favorites": favorites
        })

    except Exception as e:
        logger.error(f"Error in favorite operation: {str(e)}")
        return jsonify({"error": "Operation failed"}), 500

@app.route('/api/favorite-song', methods=['POST'])
def favorite_song():
    """Add a song to user's favorites room"""
    data = request.json
    track = data.get('track')
    auth_token = request.headers.get('Authorization')
    
    if not track:
        return jsonify({"error": "Track data is required"}), 400
    
    # Verify user is logged in
    if not auth_token:
        return jsonify({"error": "Authentication required"}), 401
    
    username = get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return jsonify({"error": "Invalid authentication token"}), 401
    
    try:
        # Create or get the user's favorites room
        favorites_room_name = f"favorites_{username}"
        
        # Get existing playlist or create new one
        existing_playlist_json = get_hash(f"room_playlists{redis_version}", favorites_room_name)
        if existing_playlist_json:
            existing_playlist = json.loads(existing_playlist_json)
            
            # Check if song already exists in favorites
            for song in existing_playlist:
                if song.get('song_id') == track.get('song_id'):
                    return jsonify({
                        "message": "Song already in favorites",
                        "already_favorited": True
                    })
            
            # Add the new song to favorites
            existing_playlist.append(track)
            playlist = existing_playlist
        else:
            # Create new favorites playlist with this song
            playlist = [track]
            
            # Create default settings for the room
            settings = {
                "prompt": "My Favorite Songs",
                "genre": "Mixed",
                "occasion": "Personal",
                "song_count": 0,
                "moderation_enabled": False
            }
            
            # Save settings
            write_hash(f"settings{redis_version}", favorites_room_name, json.dumps(settings))
            
            # Set user as host of the room
            profile_json = get_hash(f"user_profiles{redis_version}", username)
            if profile_json:
                profile = json.loads(profile_json)
                avatar = profile.get('avatar')
                set_room_host(favorites_room_name, username, avatar, update_timestamp=True)
            
            # Add room to user's rooms
            add_room_to_user_profile(username, favorites_room_name)
        
        # Save updated playlist
        write_hash(f"room_playlists{redis_version}", favorites_room_name, json.dumps(playlist))
        
        return jsonify({
            "message": "Song added to favorites",
            "favorites_room": favorites_room_name,
            "playlist_length": len(playlist)
        })
        
    except Exception as e:
        logger.error(f"Error adding song to favorites: {str(e)}")
        return jsonify({"error": "Failed to add song to favorites"}), 500

@app.route('/api/pin-track', methods=['POST'])
def pin_track():
    try:
        data = request.json
        room_name = data.get('room_name')
        track_id = data.get('track_id')
        current_playing_index = data.get('current_playing_index')
        selected_index = data.get('selected_index')

        if not all([room_name, track_id]):
            return jsonify({"error": "Missing required parameters"}), 400

        # Get current playlist from Redis
        playlist_json = get_hash(f"room_playlists{redis_version}", room_name)
        if not playlist_json:
            return jsonify({"error": "Playlist not found"}), 404

        playlist = json.loads(playlist_json)

        # Calculate the actual position to insert the track (after current playing track)
        insert_position = current_playing_index + 1

        # Remove the track from its current position
        track_to_pin = playlist.pop(selected_index)

        # Insert the track after the currently playing track
        playlist.insert(insert_position, track_to_pin)

        # Update Redis with the new playlist order
        redis_api.write_hash(f"room_playlists{redis_version}", room_name, json.dumps(playlist))

        return jsonify({
            "message": "Track pinned successfully",
            "playlist": playlist
        })

    except Exception as e:
        logger.error(f"Error pinning track: {str(e)}")
        return jsonify({"error": "Failed to pin track"}), 500

@app.route('/api/room/host', methods=['GET'])
def verify_room_host():
    room_name = request.args.get('room_name')
    auth_token = request.headers.get('Authorization')
    
    if not room_name:
        return jsonify({"error": "Room name is required"}), 400
    
    # Get host data
    host_data = get_room_host(room_name)
    
    # If room exists but has no host, allow anyone to be host
    if not host_data:
        # Check if room exists in playlist
        playlist_data = get_hash(f"room_playlists{redis_version}", room_name)
        if playlist_data:  # Room exists but has no host
            return jsonify({
                "host_username": None,
                "host_avatar": None,
                "allow_anyone_host": True
            })
        return jsonify({"error": "Room not found"}), 404
        
    # Return host username for frontend verification
    return jsonify({
        "host_username": host_data.get('username'),
        "host_avatar": host_data.get('avatar'),
        "allow_anyone_host": False
    })

@app.route('/api/example-prompts', methods=['GET'])
def get_example_prompts():
    """Return example prompts for the playlist generator."""
    try:
        # You can add filtering or randomization logic here if needed
        return jsonify({
            "examples": EXAMPLE_PROMPTS
        })
    except Exception as e:
        logger.error(f"Error fetching example prompts: {str(e)}")
        return jsonify({"error": "Failed to fetch example prompts"}), 500

@app.route('/api/check-favorite-song', methods=['POST'])
def check_favorite_song():
    """Check if a song is in user's favorites"""
    data = request.json
    song_id = data.get('song_id')
    auth_token = request.headers.get('Authorization')
    
    if not song_id:
        return jsonify({"error": "Song ID is required"}), 400
    
    # Verify user is logged in
    if not auth_token:
        return jsonify({"error": "Authentication required"}), 401
    
    username = get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return jsonify({"error": "Invalid authentication token"}), 401
    
    try:
        # Get the user's favorites room
        favorites_room_name = f"favorites_{username}"
        
        # Get existing playlist if it exists
        existing_playlist_json = get_hash(f"room_playlists{redis_version}", favorites_room_name)
        if existing_playlist_json:
            existing_playlist = json.loads(existing_playlist_json)
            
            # Check if song exists in favorites
            for song in existing_playlist:
                if song.get('song_id') == song_id:
                    return jsonify({
                        "is_favorited": True
                    })
        
        # If we get here, the song is not favorited
        return jsonify({
            "is_favorited": False
        })
        
    except Exception as e:
        logger.error(f"Error checking favorite song: {str(e)}")
        return jsonify({"error": "Failed to check favorite status"}), 500

if __name__ == '__main__':
    # app.run(port=3000, host='10.72.252.213', debug=True)
     socketio.run(app, port=5000, host='0.0.0.0', debug=True)
    # http://13.56.253.58/