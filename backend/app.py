from flask import Flask, request, jsonify, send_file, send_from_directory, redirect
from flask_cors import CORS
import util.gpt as gpt 
import util.llm_modules as llm
from pathlib import Path
import os
import re
import json
import uuid
import time
import random
import string
import requests
import datetime
import jwt
from datetime import datetime, timedelta
import hashlib
import secrets
import logging
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask import after_this_request
from util import redis_api, user_logging
import util.user_logging
import socketio
import eventlet
import random
import util.youtube_music as youtube_music
from io import BytesIO
from PIL import Image
import util.redis_api as redis_api
from util.redis_api import *
import redis
import util.all_utils as all_utils
from util.all_utils import *
from util.generation import *
import util.lyrics as lyrics_api
from util.lyrics import fetch_lyrics
import werkzeug.utils
from werkzeug.utils import secure_filename
from routes.activity_routes import activity_routes
from routes.payment_routes import payment_routes
from routes.coin_routes import coin_routes
from placeholder import init_placeholder_routes
from util.coin_manager import get_user_coins, set_user_coins, add_user_coins, use_user_coins

# Import the example prompts
from data.example_prompts import EXAMPLE_PROMPTS

# List of admin users
ADMIN_USERS = ['vincentliux', 'Carter']

# Configuration
FRONTEND_URL = "https://aico-music.com"

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

# Enable CORS
CORS(app, supports_credentials=True)

# Register blueprints
app.register_blueprint(activity_routes, url_prefix='/api/user-activity')
app.register_blueprint(payment_routes, url_prefix='/api/payments')
app.register_blueprint(coin_routes, url_prefix='/api/coins')

# Initialize placeholder routes
init_placeholder_routes(app)

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
    
    # Log user activity if it's a registered user (not a guest)
    if username != 'Guest':
        user_logging.log_user_activity(
            username=username,
            action="join_room",
            room_name=room_name,
            details={"is_host": is_host}
        )

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
    
    # Log user activity if it's a registered user (not a guest)
    if username != 'Guest':
        user_logging.log_user_activity(
            username=username,
            action="leave_room",
            room_name=room_name
        )

@socketio.on('player_state_change')
def handle_player_state_change(data):
    """Handle player state changes (play, pause, etc.)"""
    try:
        room_name = data.get('room_name')
        username = data.get('username')
        
        # Log the data for debugging
        logger.info(f"Player state change: {data}")
        
        # Try to get username from the socket session
        if not username or username.lower() == 'guest':
            # Get username from the room host data
            if room_name:
                try:
                    host_data = redis_client.hgetall(f"room_host{redis_version}:{room_name}")
                    if host_data and b'username' in host_data:
                        username = host_data[b'username'].decode('utf-8')
                        logger.info(f"Using room host as username: {username}")
                except Exception as e:
                    logger.error(f"Error getting room host: {str(e)}")
        
        # Check for both state and player_state for backward compatibility
        player_state = data.get('player_state', {})
        is_playing = player_state.get('isPlaying', False)
        current_track = player_state.get('currentTrack', 0)
        video_id = player_state.get('videoId', '')
        position = player_state.get('currentTime', 0)
        
        # Convert isPlaying to state format
        state = "playing" if is_playing else "paused"
        
        # Update the room's player state in Redis
        redis_api.update_room_player_state(room_name, state, position)
        
        # Always log song plays, even for guest users, but only once per song session
        if room_name and is_playing:
            # First try to get song info from the room playlist
            room_data = redis_api.get_room_data(room_name)
            current_playlist = room_data.get('playlist', [])
            current_song = None
            
            # Try to get the song from the playlist using currentTrack
            if current_playlist and 0 <= current_track < len(current_playlist):
                current_song = current_playlist[current_track]
            
            # If we have a song and the state is playing
            if current_song or video_id:
                # Use actual username if available, otherwise use 'guest'
                log_username = username if username and username.lower() != 'guest' else 'guest'
                song_id = current_song.get('song_id') if current_song else video_id
                
                # Check if this song was recently logged to avoid duplicate logs
                last_played_key = f"last_played:{room_name}"
                last_played = redis_client.get(last_played_key)
                
                # Only log if this is a different song than the last one played in this room
                if not last_played or last_played.decode('utf-8') != song_id:
                    # Update the last played song for this room
                    redis_client.set(last_played_key, song_id)
                    redis_client.expire(last_played_key, 3600)  # Expire after 1 hour
                    
                    # Log the play action
                    title = current_song.get('title', '') if current_song else 'Unknown'
                    artist = current_song.get('artist', '') if current_song else 'Unknown'
                    
                    logger.info(f"Logging play_song for user {log_username}, song {title if title else video_id} in room {room_name}")
                    
                    # Log the play action using user_logging module
                    user_logging.log_user_activity(
                        username=log_username,
                        action="play_song",
                        song_id=song_id,
                        room_name=room_name,
                        details={
                            "title": title,
                            "artist": artist,
                            "position": position
                        }
                    )
                    
                    # Increment play count in Redis
                    new_count = redis_api.increment_song_play_count(song_id, title=title, artist=artist)
                    logger.info(f"Incremented play count for song {song_id} to {new_count}")
        
        # Broadcast the player state to all clients in the room
        emit('player_state_update', player_state, room=room_name)
        
    except Exception as e:
        logger.error(f"Error handling player state change: {str(e)}")

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
    genre = data.get('genre', '')
    occasion = data.get('occasion', '')
    room_name = data.get('room_name')
    song_count = data.get('song_count', 20)  # Default to 20 if not provided
    append_to_room = data.get('append_to_room', False)  # New parameter to handle append mode
    moderation = data.get('moderation', 'no')  # Get moderation setting from request
    niche_level = data.get('niche_level', 50)  # Get niche level (0-100), default to 50 (balanced)
    
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
        logger.info(f"Niche level: {niche_level}")

        settings = {
            "prompt": prompt,
            "genre": genre,
            "occasion": occasion,
            "song_count": song_count,
            "moderation_enabled": moderation == 'yes',  # Convert string to boolean
            "niche_level": niche_level  # Store niche level in settings
        }

        # Initialize variables for the song generation loop
        all_titles = []
        all_artists = []
        unique_titles = set()
        max_attempts = 3  # Maximum number of attempts to get enough songs
        attempt = 0
        current_prompt = prompt
        target_song_count = song_count
        
        # Keep requesting songs until we have enough unique ones or reach max attempts
        while len(unique_titles) < target_song_count and attempt < max_attempts:
            # Request 50% more songs than needed to account for duplicates
            requested_count = int((target_song_count - len(unique_titles)) * 1.5)
            
            logger.info(f'Attempt {attempt+1}: Requesting {requested_count} songs. Current unique count: {len(unique_titles)}')
            
            # If this is not the first attempt, include existing songs in the prompt to avoid duplicates
            if attempt > 0:
                existing_songs = ', '.join([f'"{title}" by {artist}' for title, artist in zip(all_titles, all_artists)])
                current_prompt = f"{prompt}\n\nPlease provide {requested_count} MORE songs that are DIFFERENT from these existing songs: {existing_songs}"
                logger.info(f'Updated prompt with existing songs')
            
            # Get new songs from LLM
            titles, artists, introduction, reply = llm.llm_generate_playlist(current_prompt, genre, occasion, requested_count, niche_level)
            logger.info(f'LLM returned {len(titles)} songs')
            logger.info(str(reply))
            
            # Add new songs to our lists, checking for duplicates by title only
            for title, artist in zip(titles, artists):
                title_lower = title.lower().strip()
                if title_lower not in unique_titles:
                    all_titles.append(title)
                    all_artists.append(artist)
                    unique_titles.add(title_lower)
                else:
                    logger.info(f'Skipping duplicate title: {title}')
            
            attempt += 1
        
        logger.info(f'Final unique song count: {len(unique_titles)} out of {target_song_count} requested')
        
        # Now get song info for all unique songs
        new_playlist = []
        
        for title, artist in zip(all_titles, all_artists):
            try:
                logger.info(f'getting links for {title}...')
                song_info = youtube_music.get_song_info(song_name=title, artist_name=artist)
                new_playlist.append(song_info)
            except Exception as e:
                logger.info(f'----failed for {title}, {artist}', e)
        
        logger.info(str(new_playlist))

        new_playlist = new_playlist[:song_count]
        logger.info('--- new playlist after CAP:', str(new_playlist))

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
                    
                    # Log playlist append activity
                    if username:
                        user_logging.log_user_activity(
                            username=username,
                            action="append_to_playlist",
                            room_name=room_name,
                            details={
                                "songs_added": len(deduplicated_new_playlist),
                                "duplicates_removed": len(new_playlist) - len(deduplicated_new_playlist),
                                "total_songs": len(combined_playlist)
                            }
                        )
                    
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
        if username:
            set_room_host(room_name, username, avatar or '/images/default_avatar.png', update_timestamp=False)
            add_room_to_user_profile(username, room_name)
            
            # Log room creation activity
            user_logging.log_user_activity(
                username=username,
                action="create_room",
                room_name=room_name,
                details={
                    "prompt": prompt,
                    "genre": genre,
                    "occasion": occasion,
                    "song_count": song_count,
                    "moderation_enabled": moderation == 'yes',
                    "playlist_size": len(new_playlist)
                }
            )

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
    build_path = Path(__file__).parent.parent / 'frontend' / 'react_dj' / 'build' / 'images' / f"qr_code_{safe_room_name}.png"
    if not build_path.exists():
        # Create images directory if it doesn't exist
        qr_code_path.parent.mkdir(parents=True, exist_ok=True)
        generate_qr_code_with_logo(f'http://aico-music.com/playroom?room_name={room_name}', qr_code_path)
        logger.info(f"Generated QR code for room: {room_name} into {qr_code_path}")
        
        # build_path = Path(__file__).parent.parent / 'frontend' / 'react_dj' / 'build' / 'images' / f"qr_code_{safe_room_name}.png"
        build_path.parent.mkdir(parents=True, exist_ok=True)
        generate_qr_code_with_logo(f'http://aico-music.com/playroom?room_name={room_name}', build_path)
        logger.info(f"Generated QR code for room: {room_name} into {build_path}")

    try:
        # Get existing playlist data
        time.sleep(0.5)
        playlist_data = get_hash(f"room_playlists{redis_version}", room_name)
        if not playlist_data:
            logger.warning(f"No playlist data found for room: {room_name}")
            playlist = []
        else:
            playlist = json.loads(playlist_data)
            # Deduplicate playlist based on song title (case-insensitive)
            deduped_playlist = []
            seen_titles = set()
            for song in playlist:
                title_key = song.get('title', '').strip().lower()
                if title_key and title_key not in seen_titles:
                    deduped_playlist.append(song)
                    seen_titles.add(title_key)
            playlist = deduped_playlist
        
        settings_data = get_hash(f"settings{redis_version}", room_name)
        if not settings_data:
            logger.warning(f"No settings data found for room: {room_name}")
            settings = {}
        else:
            settings = json.loads(settings_data)
            
        introduction = get_hash(f"intro{redis_version}", room_name) or ""

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
    elif search_type == 'prompt':
        # Use the LLM to generate song recommendations based on the prompt
        try:
            # Default to 10 songs for prompt-based search
            song_count = 10
            titles, artists, _, _ = llm.llm_generate_playlist(query, "", "", song_count)
            
            results = []
            for title, artist in zip(titles, artists):
                try:
                    logger.info(f'getting links for {title}...')
                    song_info = youtube_music.get_song_info(song_name=title, artist_name=artist)
                    results.append(song_info)
                except Exception as e:
                    logger.info(f'----failed for {title}, {artist}', e)
            
            logger.info(f"Prompt search results: {results}")
        except Exception as e:
            logger.error(f"Error in prompt search: {str(e)}")
            results = []
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

    # Get username if logged in
    auth_token = request.headers.get('Authorization')
    username = None
    if auth_token:
        username = get_hash(f"sessions{redis_version}", auth_token)
    
    if not all([room_name, track]):
        logger.error(f"Missing required fields: room_name={room_name}, track={'present' if track else 'missing'}")
        return jsonify({"error": "Missing required fields"}), 400
        
    try:
        logger.info(f"Processing track addition for room {room_name} by {username or 'Guest'}")
        logger.info(f"Track info: {json.dumps(track)}")
        
        # Check if the user is the host of the room
        host_info = get_room_host(room_name)
        is_host = False
        if host_info and username and username == host_info.get('username'):
            is_host = True
        
        # Get room settings to check moderation status
        settings_json = get_hash(f"settings{redis_version}", room_name)
        settings = json.loads(settings_json) if settings_json else {}
        moderation_enabled = settings.get('moderation_enabled', False)
        
        # If moderation is enabled and user is not the host, check if AI moderation is enabled
        if moderation_enabled and not is_host:
            # Get AI moderation settings
            ai_moderation_settings = get_room_ai_moderation_settings(room_name)
            ai_moderation_enabled = ai_moderation_settings.get('enabled', False)
            
            if ai_moderation_enabled:
                # Get song details for moderation
                song_title = track.get('title', '')
                song_artist = track.get('artist', '')
                
                # Use LLM to check if song matches moderation criteria
                moderation_result = llm.llm_moderate_song(
                    song_title=song_title,
                    song_artist=song_artist,
                    moderation_description=ai_moderation_settings.get('description', ''),
                    strictness_level=ai_moderation_settings.get('strictness_level', 'medium')
                )
                
                # Record the moderation decision
                moderation_decision = {
                    "timestamp": datetime.now().isoformat(),
                    "song_title": song_title,
                    "song_artist": song_artist,
                    "requested_by": username or "Guest",
                    "approved": moderation_result.get('approved', False),
                    "score": moderation_result.get('score', 0),
                    "reasoning": moderation_result.get('reasoning', ''),
                    "attributes": moderation_result.get('song_attributes', {})
                }
                
                # Add the decision to moderation history
                add_room_ai_moderation_decision(room_name, moderation_decision)
                
                # If song is not approved, return rejection message
                if not moderation_result.get('approved', False):
                    logger.info(f"AI moderation rejected song '{song_title}' by '{song_artist}' for room {room_name}")
                    return jsonify({
                        "error": "Song rejected by AI moderation",
                        "moderation_result": moderation_result
                    }), 403
                
                logger.info(f"AI moderation approved song '{song_title}' by '{song_artist}' for room {room_name}")
            elif not is_host:
                # Regular moderation is enabled but AI moderation is not
                # In this case, the host needs to manually approve songs
                logger.info(f"Song '{track.get('title')}' needs manual approval from host for room {room_name}")
                return jsonify({"error": "This room requires host approval for songs"}), 403
        
        # Fetch the existing playlist
        playlist_json = get_hash(f"room_playlists{redis_version}", room_name)
        playlist = json.loads(playlist_json) if playlist_json else []

        # Add the new track to the playlist
        playlist.append(track)
        logger.info(f'Added track: {track.get("title")} by {track.get("artist")} in room: {room_name}')

        # Update the playlist in Redis
        write_hash(f"room_playlists{redis_version}", room_name, json.dumps(playlist))

        # Log user activity if logged in
        if username:
            user_logging.log_user_activity(
                username=username,
                action="add_song",
                room_name=room_name,
                song_id=track.get('song_id'),
                details={
                    "title": track.get('title'),
                    "artist": track.get('artist'),
                    "source": "manual_add",
                    "ai_moderated": moderation_enabled and ai_moderation_enabled if not is_host else False
                }
            )

        return jsonify({
            "message": "Track added successfully",
            "ai_moderated": moderation_enabled and ai_moderation_enabled if not is_host else False
        })

    except Exception as e:
        logger.error(f"Error adding track to playlist: {str(e)}")
        return jsonify({"error": f"Failed to add track to playlist: {str(e)}"}), 500

@app.route('/api/remove-from-playlist', methods=['POST'])
def remove_from_playlist():
    data = request.json
    room_name = data.get('room_name')
    track_id = data.get('track_id')

    # Get username if logged in
    auth_token = request.headers.get('Authorization')
    username = None
    if auth_token:
        username = get_hash(f"sessions{redis_version}", auth_token)

    # Fetch the existing playlist for the given room_name
    playlist = json.loads(redis_api.get_hash(f"room_playlists{redis_version}", room_name))

    # Find track details before removing for logging
    removed_track = None
    for track in playlist:
        if track.get('song_id') == track_id:
            removed_track = track
            break

    # Find and remove the track with the matching song_id instead of id
    updated_playlist = [track for track in playlist if track.get('song_id') != track_id]
    
    # Log the removal operation
    logger.info(f'removed track with song_id:{track_id} from room:{room_name}')
    logger.info(f'new playlist:{updated_playlist}')

    # Update the playlist in Redis
    redis_api.write_hash(f"room_playlists{redis_version}", room_name, json.dumps(updated_playlist))

    # Log user activity if logged in and track was found
    if username and removed_track:
        user_logging.log_user_activity(
            username=username,
            action="remove_song",
            room_name=room_name,
            song_id=track_id,
            details={
                "title": removed_track.get('title'),
                "artist": removed_track.get('artist')
            }
        )

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
    try:
        data = request.json
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        
        if not all([username, email, password]):
            return jsonify({"error": "Missing required fields"}), 400
        
        # Validate username (alphanumeric and underscore only)
        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            return jsonify({"error": "Username can only contain letters, numbers, and underscores"}), 400
        
        # Check if username exists
        if get_hash(f"users{redis_version}", username):
            return jsonify({"error": "Username already exists"}), 409
        
        # Hash password and store user data
        password_hash = hash_password(password)
        write_hash(f"users{redis_version}", username, password_hash)
        
        # Store user profile
        profile = {
            "username": username,
            "email": email,
            "created_at": datetime.now().isoformat(),
            "has_avatar": False,  # Initialize with no avatar
        }
        write_hash(f"user_profiles{redis_version}", username, json.dumps(profile))
        
        # Set initial coins using the unified coin management system
        set_user_coins(username, 1000, "Initial allocation for new user")
        
        # Generate session token
        session_token = secrets.token_urlsafe(32)
        redis_api.write_hash(f"sessions{redis_version}", session_token, username)
        
        # Log user registration
        user_agent = request.headers.get('User-Agent', 'Unknown')
        ip_address = request.remote_addr
        user_logging.log_user_activity(
            username=username,
            action="register",
            details={"user_agent": user_agent, "ip_address": ip_address, "email": email}
        )
        
        # Get the profile with coins for the response
        profile["coins"] = get_user_coins(username)
        
        return jsonify({
            "token": session_token,
            "user": profile
        }), 201
    except Exception as e:
        logger.error(f"Error registering user: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')
        
        logger.info(f"Login attempt for user: {username}")
        
        if not all([username, password]):
            logger.warning(f"Login failed for {username}: Missing credentials")
            return jsonify({"error": "Missing credentials"}), 400
        
        # Get stored password hash
        stored_hash = get_hash(f"users{redis_version}", username)
        logger.info(f"Login for {username}: Stored hash: {stored_hash}")
        
        if not stored_hash:
            logger.warning(f"Login failed for {username}: User not found")
            return jsonify({"error": "Invalid username or password"}), 401
        
        # Verify password
        hashed_password = hash_password(password)
        logger.info(f"Login for {username}: Input hash: {hashed_password}")
        
        if hashed_password != stored_hash:
            logger.warning(f"Login failed for {username}: Password mismatch")
            return jsonify({"error": "Invalid username or password"}), 401
        
        # Generate session token
        session_token = secrets.token_urlsafe(32)
        redis_api.write_hash(f"sessions{redis_version}", session_token, username)
        
        # Get user profile or create default one
        profile_json = get_hash(f"user_profiles{redis_version}", username)
        if profile_json:
            profile = json.loads(profile_json)
        else:
            # Create default profile with avatar
            profile = {
                "username": username,
                "created_at": datetime.now().isoformat(),
                "has_avatar": False,
                "coins": 0
            }
            write_hash(f"user_profiles{redis_version}", username, json.dumps(profile))
        
        # Get coins using the unified coin management system
        profile["coins"] = get_user_coins(username)
        
        # Log user login activity
        user_agent = request.headers.get('User-Agent', 'Unknown')
        ip_address = request.remote_addr
        user_logging.log_user_activity(
            username=username,
            action="login",
            details={"user_agent": user_agent, "ip_address": ip_address}
        )
        
        logger.info(f"Login successful for {username}")
        return jsonify({
            "token": session_token,
            "user": profile
        }), 200
    except Exception as e:
        logger.error(f"Login error for {username if 'username' in locals() else 'unknown'}: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    auth_token = request.headers.get('Authorization')
    if auth_token:
        # Get username from session
        username = get_hash(f"sessions{redis_version}", auth_token)
        if username:
            # Log user logout activity
            user_logging.log_user_activity(
                username=username,
                action="logout"
            )
        
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

# User authentication endpoint
@app.route('/api/auth/user', methods=['GET'])
def get_current_user_direct():
    """Get current user data directly"""
    try:
        # Get auth token from request
        auth_header = request.headers.get('Authorization')
        logger.info(f"Auth endpoint called with header: {auth_header[:15]}..." if auth_header and len(auth_header) > 15 else "No auth header or short header")
        
        if not auth_header:
            logger.warning("Auth endpoint: No token provided")
            return jsonify({"error": "No token provided"}), 401
        
        # Extract token from Authorization header (handle Bearer token format)
        auth_token = auth_header
        if auth_header.startswith('Bearer '):
            auth_token = auth_header[7:]  # Remove 'Bearer ' prefix
            logger.info(f"Auth endpoint: Extracted token from Bearer format: {auth_token[:10]}...")
        
        # Get username from session
        # redis_version = os.environ.get('REDIS_VERSION', '')
        username = redis_api.get_hash(f"sessions{redis_version}", auth_token)
        logger.info(f"Auth endpoint: Username from token: {username}")
        
        if not username:
            logger.warning(f"Auth endpoint: Invalid or expired token: {auth_token[:10]}...")
            return jsonify({"error": "Invalid or expired token"}), 401
        
        # Get user data
        user_data = redis_api.get_user_data(username)
        logger.info(f"Auth endpoint: User data for {username}: {user_data}")
        
        # Check admin status
        is_admin_from_data = user_data.get('is_admin', False)
        is_admin_from_username = username in ADMIN_USERS
        final_admin_status = is_admin_from_data or is_admin_from_username
        
        # Get user coins using the unified coin management system
        coins = get_user_coins(username)
        
        logger.info(f"Auth endpoint: Admin status for {username}: from data={is_admin_from_data}, from username={is_admin_from_username}, final={final_admin_status}")
        
        return jsonify({
            "success": True,
            "user": {
                "username": username,
                "is_admin": final_admin_status,
                "coins": coins
            }
        })
    except Exception as e:
        logger.error(f"Error getting current user: {str(e)}")
        return jsonify({"error": str(e)}), 500

def generate_avatar_svg(username):
    """Generate an SVG avatar with user's initials."""
    # Get first character of username (uppercase)
    initial = username[0].upper() if username else "?"
    
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
    # First check if user has an uploaded avatar
    profile_json = get_hash(f"user_profiles{redis_version}", username)
    if profile_json:
        profile = json.loads(profile_json)
        
        # Check if user has a Google profile picture
        if profile.get('google_user') and profile.get('google_picture'):
            logger.info(f"Redirecting to Google profile picture for {username}")
            return redirect(profile['google_picture'])
            
        if profile.get('has_avatar'):
            # Find the most recent avatar file for this user
            try:
                avatar_files = list(AVATARS_DIR.glob(f"{username}_*.jpg"))
                if avatar_files:
                    # Get the most recent file
                    latest_avatar = max(avatar_files, key=lambda x: x.stat().st_mtime)
                    logger.info(f"Serving avatar file {latest_avatar} for {username}")
                    return send_file(
                        str(latest_avatar),
                        mimetype='image/jpeg',
                        last_modified=latest_avatar.stat().st_mtime,
                        max_age=31536000  # Cache for 1 year
                    )
            except Exception as e:
                logger.error(f"Error serving avatar for {username}: {str(e)}")
    
    # If no uploaded avatar or error, generate SVG avatar
    logger.info(f"Generating SVG avatar for {username}")
    svg = generate_avatar_svg(username)
    response = send_file(
        BytesIO(svg.encode()),
        mimetype='image/svg+xml',
        max_age=3600  # Cache for 1 hour
    )
    return response

# Add room host functions
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
            "introduction": intro[:100] + '...' if intro and len(intro) > 100 else intro,
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

        # Get followers list for the target user
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
                            "avatar": get_user_avatar_url(follow_username),
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
                            "avatar": get_user_avatar_url(follower_username),
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

@app.route('/api/user/favorites', methods=['GET'])
def get_user_favorites():
    """Get the list of user's favorite rooms"""
    auth_token = request.headers.get('Authorization')
    if not auth_token:
        return jsonify({"error": "Authentication required"}), 401

    username = get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return jsonify({"error": "Invalid session"}), 401

    try:
        # Get current favorites list
        favorites_json = get_hash(f"user_favorites{redis_version}", username)
        favorites = json.loads(favorites_json) if favorites_json else []
        
        # Get room details for each favorite
        favorite_rooms = []
        for room_name in favorites:
            room_data = get_hash(f"room_hosts{redis_version}", room_name)
            if room_data:
                room_info = json.loads(room_data)
                # Ensure the room name is included in the response
                room_info["name"] = room_name
                favorite_rooms.append(room_info)
            else:
                # If room data is missing, create a minimal room object with just the name
                favorite_rooms.append({
                    "name": room_name,
                    "exists": False,
                    "creator": "Unknown"
                })
        
        return jsonify({
            "favorites": favorite_rooms
        })
    
    except Exception as e:
        logger.error(f"Error retrieving favorites: {str(e)}")
        return jsonify({"error": "Failed to retrieve favorites"}), 500

@app.route('/api/user/avatar', methods=['POST'])
def upload_avatar():
    auth_token = request.headers.get('Authorization')
    if not auth_token:
        return jsonify({"error": "Authentication required"}), 401

    username = get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return jsonify({"error": "Invalid session"}), 401

    if 'avatar' not in request.files:
        logger.error("No avatar file in request")
        return jsonify({"error": "No file provided"}), 400

    file = request.files['avatar']
    if file.filename == '':
        logger.error("Empty filename in avatar upload")
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        logger.error(f"Invalid file type: {file.filename}")
        return jsonify({"error": "Invalid file type"}), 400

    try:
        # Process and save image
        logger.info(f"Processing avatar upload for user {username}")
        image = Image.open(file)
        
        # Resize to standard size
        image.thumbnail((400, 400))
        
        # Convert to RGB if necessary
        if image.mode in ('RGBA', 'P'):
            image = image.convert('RGB')
        
        # Generate unique filename with timestamp
        filename = f"{username}_{int(time.time())}.jpg"
        
        # Save to both backend and frontend directories to ensure consistency
        backend_filepath = AVATARS_DIR / filename
        frontend_filepath = Path(__file__).parent.parent / 'frontend' / 'react_dj' / 'build' / 'static' / 'avatars' / filename
        
        # Create directories if they don't exist
        AVATARS_DIR.mkdir(parents=True, exist_ok=True)
        frontend_dir = Path(__file__).parent.parent / 'frontend' / 'react_dj' / 'build' / 'static' / 'avatars'
        frontend_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f'saving avatar for {username} at {backend_filepath} and {frontend_filepath}')
        
        # Save optimized image to both locations
        image.save(str(backend_filepath), 'JPEG', quality=85, optimize=True)
        image.save(str(frontend_filepath), 'JPEG', quality=85, optimize=True)
        
        # Update user profile in Redis
        profile_json = get_hash(f"user_profiles{redis_version}", username)
        profile = json.loads(profile_json) if profile_json else format_user_profile(username)
        profile['has_avatar'] = True
        write_hash(f"user_profiles{redis_version}", username, json.dumps(profile))
        
        # Update room host avatars if needed
        all_rooms = get_all_hash(f"room_playlists{redis_version}")
        all_room_names = list(all_rooms.keys())
        for room_name in all_room_names:
            host_data = get_room_host(room_name)
            if host_data and host_data.get('username') == username:
                set_room_host(room_name, username, f"/api/avatar/{username}", update_timestamp=False)
        
        # Return the URL path that matches where the frontend expects to find the avatar
        avatar_url = f"/static/avatar/{username}"
        logger.info(f"Avatar upload successful for {username}, URL: {avatar_url}")
        return jsonify({
            "message": "Avatar uploaded successfully",
            "avatar_url": avatar_url
        }), 200

    except Exception as e:
        logger.error(f"Error uploading avatar for {username}: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/api/avatars/<path:filename>')
def serve_avatar_file(filename):
    """Serve an avatar file from the avatars directory."""
    logger.info(f"Serving avatar file: {filename}")
    try:
        # First check the backend avatars directory
        logger.info(f"Checking backend avatars directory: {AVATARS_DIR / filename}")
        if (AVATARS_DIR / filename).exists():
            # return send_from_directory(str(AVATARS_DIR), filename)
            avatar_file = AVATARS_DIR / filename
            return send_file(
                        str(avatar_file),
                        mimetype='image/jpeg',
                        last_modified=avatar_file.stat().st_mtime,
                        max_age=31536000  # Cache for 1 year
                    )

        
        # Then check the frontend static avatars directory
        frontend_dir = Path(__file__).parent.parent / 'frontend' / 'react_dj' / 'build' / 'static' / 'avatars'
        logger.info(f"Checking frontend avatars directory: {frontend_dir / filename}")
        if (frontend_dir / filename).exists():
            return send_file(
                str(frontend_dir / filename),
                mimetype='image/jpeg',
                last_modified=(frontend_dir / filename).stat().st_mtime,
                max_age=31536000  # Cache for 1 year
            )
        
        # If not found, log a warning and return 404
        logger.warning(f"Avatar file not found: {filename}")
        return "Avatar not found", 404
    except Exception as e:
        logger.error(f"Error serving avatar file {filename}: {str(e)}")
        return "Error serving avatar", 500


# Add route to serve static files (if needed)
@app.route('/images/<path:filename>')
def serve_image_file(filename):
    """
    Serve image files from the frontend build/images directory.
    This endpoint handles requests to /images/* paths.
    
    Args:
        filename: The name of the image file to serve
        
    Returns:
        The requested image file
    """
    logger.info(f"Serving image: {filename}")
    images_dir = Path(__file__).parent.parent / 'frontend' / 'react_dj' / 'build' / 'images'
    
    # Create the directory if it doesn't exist
    images_dir.mkdir(parents=True, exist_ok=True)
    
    # Also check the public directory as a fallback
    public_images_dir = Path(__file__).parent.parent / 'frontend' / 'react_dj' / 'public' / 'images'
    
    # First try to serve from build/images
    if (images_dir / filename).exists():
        return send_from_directory(images_dir, filename)
    # Then try to serve from public/images
    elif (public_images_dir / filename).exists():
        return send_from_directory(public_images_dir, filename)
    else:
        logger.error(f"Image not found: {filename}")
        return jsonify({"error": "Image not found"}), 404

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

    # ------------------------------------------------------------------
    # Coin deduction & express request handling
    # ------------------------------------------------------------------
    express_request = bool(data.get('express', False))

    # Determine room-specific request price (default→30)
    price_key = f"room_request_price{redis_version}"
    price_val = get_hash(price_key, room_name)
    try:
        base_price = int(price_val) if price_val else 30
    except (TypeError, ValueError):
        base_price = 30

    # Express requests price = host-set request price + pin price (combined)
    if express_request:
        # Fetch pin price for the room (default 10 if not set)
        pin_key = f"room_pin_price{redis_version}"
        pin_val = get_hash(pin_key, room_name)
        try:
            pin_price = int(pin_val) if pin_val else 10
        except (TypeError, ValueError):
            pin_price = 10

        request_price = base_price + pin_price
    else:
        request_price = base_price

    # Enforce authentication – guests cannot submit paid requests
    if not username:
        return jsonify({"error": "Authentication required to request tracks"}), 401

    # Deduct coins atomically from requester
    coin_result = use_user_coins(
        username=username,
        amount=request_price,
        feature="express_request" if express_request else "song_request"
    )
    if not coin_result.get("success"):
        return jsonify({
            "error": coin_result.get("error", "Insufficient coins"),
            "coins": coin_result.get("coins", 0)
        }), 402

    # Credit coins to the room host (if different from requester)
    host_info = get_room_host(room_name)
    host_username = None
    if host_info:
        host_username = host_info.get("username") if isinstance(host_info, dict) else host_info
    if host_username and host_username != username:
        add_user_coins(host_username, request_price, reason="track_request_reward")

    # Annotate track metadata
    track['express'] = express_request
    track['price'] = request_price
    
    # Store requester info (username & avatar) for UI display
    track['requested_by_username'] = username if username else "Guest"
    track['requested_by'] = username if username else "Guest"
    track['requested_by_avatar'] = get_user_avatar_url(username) if username else None
    
    if not all([room_name, track]):
        logger.error(f"Missing required fields: room_name={room_name}, track={'present' if track else 'missing'}")
        return jsonify({"error": "Missing required fields"}), 400
        
    try:
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
        
        # Get AI moderation settings for logging
        ai_settings = get_room_ai_moderation_settings(room_name)
        ai_enabled = ai_settings.get('enabled', False)
        
        logger.info(f"Moderation settings for room {room_name}: moderation={moderation_enabled}, ai_moderation={ai_enabled}")
        logger.info(f"Full AI moderation settings: {ai_settings}")
        
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
            
            # Insert the track respecting express flag
            if track.get('express'):
                current_state = room_player_states.get(room_name, {}) if 'room_player_states' in globals() else {}
                current_index = current_state.get('index', -1)
                if current_index is not None and current_index >= 0 and current_index < len(playlist):
                    insert_pos = current_index + 1
                else:
                    insert_pos = 1 if len(playlist) >= 1 else 0
                playlist.insert(insert_pos, track)
                logger.info(f"Inserted express track at position {insert_pos} in playlist for {room_name}")
            else:
                playlist.append(track)
            
            # Update the playlist in Redis
            # redis_client.set(f"playlist:{room_name}", json.dumps(playlist))
            
            redis_api.write_hash(f"room_playlists{redis_version}", room_name, json.dumps(playlist))

            logger.info(f"Track added directly to playlist for room {room_name} (moderation off)")
            
            return jsonify({
                "message": "Track added to playlist",
                "request_id": request_id,
                "moderated": False
            })
        
        # With moderation enabled, check if AI moderation is also enabled
        ai_moderation_settings = get_room_ai_moderation_settings(room_name)
        ai_moderation_enabled = ai_moderation_settings.get('enabled', False)
        
        # If AI moderation is enabled, check the song against AI criteria
        if ai_moderation_enabled:
            logger.info(f"AI Moderation is enabled for room {room_name}, checking song against AI criteria")
            song_title = track.get('title', '')
            song_artist = track.get('artist', '')
            
            # Use LLM to check if song matches moderation criteria
            logger.info(f"Calling LLM to moderate song: '{song_title}' by '{song_artist}'")
            logger.info(f"Using description: '{ai_moderation_settings.get('description', '')}'")
            logger.info(f"Using strictness level: '{ai_moderation_settings.get('strictness_level', 'medium')}'")
            
            try:
                moderation_result = llm.llm_moderate_song(
                    song_title=song_title,
                    song_artist=song_artist,
                    moderation_description=ai_moderation_settings.get('description', ''),
                    strictness_level=ai_moderation_settings.get('strictness_level', 'medium')
                )
                logger.info(f"LLM moderation result: {moderation_result}")
            except Exception as e:
                logger.error(f"Error during LLM moderation: {str(e)}")
                # Default to manual moderation if LLM fails
                moderation_result = {
                    'approved': False,
                    'score': 0,
                    'reasoning': f'Error during AI moderation: {str(e)}',
                    'song_attributes': {}
                }

            logger.info(f"AI moderation settings for room {room_name}: {ai_moderation_settings}")
            logger.info(f"AI moderation result for song '{song_title}' by '{song_artist}' for room {room_name}: {moderation_result}")   
            
            # Record the moderation decision
            moderation_decision = {
                "timestamp": datetime.now().isoformat(),
                "song_title": song_title,
                "song_artist": song_artist,
                "requested_by": username or "Guest",
                "approved": moderation_result.get('approved', False),
                "score": moderation_result.get('score', 0),
                "reasoning": moderation_result.get('reasoning', ''),
                "attributes": moderation_result.get('song_attributes', {})
            }
            
            # Add the decision to moderation history
            add_room_ai_moderation_decision(room_name, moderation_decision)
            
            # If song is approved by AI, add directly to playlist
            if moderation_result.get('approved', False):
                logger.info(f"AI moderation approved song '{song_title}' by '{song_artist}' for room {room_name}, adding to playlist")
                
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
                
                # Insert the track respecting express flag
                if track.get('express'):
                    current_state = room_player_states.get(room_name, {}) if 'room_player_states' in globals() else {}
                    current_index = current_state.get('index', -1)
                    if current_index is not None and current_index >= 0 and current_index < len(playlist):
                        insert_pos = current_index + 1
                    else:
                        insert_pos = 1 if len(playlist) >= 1 else 0
                    playlist.insert(insert_pos, track)
                    logger.info(f"Inserted express track at position {insert_pos} in playlist for {room_name}")
                else:
                    playlist.append(track)
                
                # Update the playlist in Redis
                redis_api.write_hash(f"room_playlists{redis_version}", room_name, json.dumps(playlist))

                logger.info(f"Track added directly to playlist for room {room_name} (AI moderation approved)")
                
                return jsonify({
                    "message": "Track approved by AI moderation and added to playlist",
                    "request_id": request_id,
                    "moderated": True,
                    "ai_moderated": True,
                    "approved": True
                })
            else:
                # If rejected by AI, still add to pending requests for host review
                logger.info(f"AI moderation rejected song '{song_title}' by '{song_artist}' for room {room_name}, adding to pending requests")
                track['status'] = 'pending'
                track['ai_moderation_result'] = moderation_result
                
                # Convert track to JSON for storage
                track_json = json.dumps(track)
                
                # Store the request in Redis
                write_hash(f"track_requests{redis_version}", request_id, track_json)
                logger.info(f"Stored track request with ID {request_id} in track_requests{redis_version} (rejected by AI moderation)")
        else:
            # Regular moderation without AI
            logger.info(f"Regular moderation is on (no AI), adding track to pending requests for {room_name}")
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
        
        # Return appropriate response for moderated requests
        return jsonify({
            "message": "Track requested successfully",
            "request_id": request_id,
            "moderated": True,
            "ai_moderated": ai_moderation_enabled
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
        
        # ------------------------------------------------------------------
        # Add the track to the room's playlist – handle express insertion
        # ------------------------------------------------------------------
        playlist_json = get_hash(f"room_playlists{redis_version}", room_name)
        try:
            playlist = json.loads(playlist_json) if playlist_json else []
        except Exception:
            logger.error(f"Invalid JSON in playlist for room {room_name}: {playlist_json}")
            playlist = []

        # If express flag, insert right after currently playing song
        if track.get("express"):
            current_state = room_player_states.get(room_name, {}) if 'room_player_states' in globals() else {}
            current_index = current_state.get('index', -1)
            if current_index is not None and isinstance(current_index, int) and 0 <= current_index < len(playlist):
                insert_pos = current_index + 1
            else:
                insert_pos = 1 if len(playlist) >= 1 else 0
            playlist.insert(insert_pos, track)
            logger.info(f"Approved EXPRESS request – inserted track at position {insert_pos} for room {room_name}")
        else:
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
    
    # Get the room host
    host_info = get_room_host(room_name)
    if not host_info or not username or username != host_info.get('username'):
        return jsonify({"error": "Only the host can update moderation settings"}), 403
    
    try:
        # Get current settings
        settings_key = f"settings{redis_version}"
        settings_json = get_hash(settings_key, room_name)
        
        if settings_json:
            settings = json.loads(settings_json)
        else:
            settings = {}
        
        # Update moderation setting
        settings['moderation_enabled'] = moderation_enabled
        
        # If AI moderation is disabled, also disable it in AI moderation settings
        if not moderation_enabled:
            ai_moderation_settings = get_room_ai_moderation_settings(room_name)
            ai_moderation_settings['enabled'] = False
            update_room_ai_moderation_settings(room_name, ai_moderation_settings)
        
        # Save settings back to Redis
        write_hash(settings_key, room_name, json.dumps(settings))
        
        # Log the moderation setting change
        user_logging.log_user_activity(
            username=username,
            action="update_moderation",
            room_name=room_name,
            details={"moderation_enabled": moderation_enabled}
        )
        
        return jsonify({
            "message": "Moderation settings updated successfully",
            "moderation_enabled": moderation_enabled
        })
    
    except Exception as e:
        logger.error(f"Error updating moderation settings: {str(e)}")
        return jsonify({"error": "Failed to update moderation settings"}), 500


@app.route('/api/room/update-ai-moderation', methods=['POST'])
def update_room_ai_moderation():
    """Update AI moderation settings for a room"""
    data = request.json
    room_name = data.get('room_name')
    enabled = data.get('enabled')
    description = data.get('description')
    strictness_level = data.get('strictness_level', 'medium')
    
    logger.info(f"Updating AI moderation for room {room_name}: enabled={enabled}, strictness={strictness_level}")
    logger.info(f"Description: {description}")
    
    if not room_name:
        return jsonify({"error": "Room name is required"}), 400
    
    # Verify if user is the host of the room
    auth_token = request.headers.get('Authorization')
    if not auth_token:
        return jsonify({"error": "Authorization required"}), 401
    
    username = get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return jsonify({"error": "Invalid authorization"}), 401
    
    host_info = get_room_host(room_name)
    if not host_info or not isinstance(host_info, dict) or host_info.get('username') != username:
        return jsonify({"error": "Only room hosts can update AI moderation settings"}), 403
    
    try:
        # First check if regular moderation is enabled when enabling AI moderation
        settings_key = f"settings{redis_version}"
        settings_json = get_hash(settings_key, room_name)
        
        if settings_json:
            settings = json.loads(settings_json)
        else:
            settings = {}
        
        # AI moderation requires regular moderation to be enabled
        if enabled and not settings.get('moderation_enabled', False):
            # Enable regular moderation if AI moderation is being enabled
            settings['moderation_enabled'] = True
            write_hash(settings_key, room_name, json.dumps(settings))
            
            logger.info(f"Automatically enabling regular moderation for room {room_name} as AI moderation is being enabled")
        
        # Update AI moderation settings
        ai_settings = {
            "enabled": enabled,
            "description": description,
            "strictness_level": strictness_level
        }
        
        # Save AI moderation settings
        update_room_ai_moderation_settings(room_name, ai_settings)
        
        # Log the AI moderation setting change
        user_logging.log_user_activity(
            username=username,
            action="update_ai_moderation",
            room_name=room_name,
            details={
                "enabled": enabled,
                "strictness_level": strictness_level
            }
        )
        
        return jsonify({
            "message": "AI moderation settings updated successfully",
            "settings": get_room_ai_moderation_settings(room_name)
        })
    
    except Exception as e:
        logger.error(f"Error updating AI moderation settings: {str(e)}")
        return jsonify({"error": "Failed to update AI moderation settings"}), 500


@app.route('/api/room/get-ai-moderation', methods=['GET'])
def get_room_ai_moderation():
    room_name = request.args.get('room_name')
    
    if not room_name:
        return jsonify({"error": "Room name is required"}), 400
    
    try:
        # Get AI moderation settings
        settings = get_room_ai_moderation_settings(room_name)
        
        logger.info(f"Returning AI moderation settings for room {room_name}: {settings}")
        return jsonify({
            "settings": settings
        })
    
    except Exception as e:
        logger.error(f"Error getting AI moderation settings: {str(e)}")
        return jsonify({"error": "Failed to get AI moderation settings"}), 500


@app.route('/api/room/ai-moderation-hints', methods=['GET'])
def get_ai_moderation_hints():
    room_name = request.args.get('room_name')
    
    if not room_name:
        return jsonify({"error": "Room name is required"}), 400
    
    try:
        # Get room playlist data
        playlist_json = get_hash(f"playlist{redis_version}", room_name)
        playlist = json.loads(playlist_json) if playlist_json else []
        
        # Get room description if available
        room_data = get_room_data(room_name)
        host_description = room_data.get('description', '')
        
        # Generate moderation hints using LLM
        hints = llm.llm_generate_moderation_hints(room_name, playlist, host_description)
        
        return jsonify({
            "hints": hints
        })
    
    except Exception as e:
        logger.error(f"Error generating AI moderation hints: {str(e)}")
        return jsonify({"error": "Failed to generate AI moderation hints"}), 500


@app.route('/api/room/ai-moderation-history', methods=['GET'])
def get_ai_moderation_history():
    room_name = request.args.get('room_name')
    auth_token = request.headers.get('Authorization')
    
    if not room_name:
        return jsonify({"error": "Room name is required"}), 400
    
    username = None
    if auth_token:
        username = get_hash(f"sessions{redis_version}", auth_token)
    
    # Get the room host
    host_info = get_room_host(room_name)
    if not host_info or not username or username != host_info.get('username'):
        return jsonify({"error": "Only the host can view AI moderation history"}), 403
    
    try:
        # Get AI moderation history
        history = get_room_ai_moderation_history(room_name)
        
        return jsonify({
            "history": history
        })
    
    except Exception as e:
        logger.error(f"Error getting AI moderation history: {str(e)}")
        return jsonify({"error": "Failed to get AI moderation history"}), 500

    
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

@app.route('/api/user/following', methods=['GET'])
def get_user_following():
    """Get the list of users that the current user is following"""
    auth_token = request.headers.get('Authorization')
    if not auth_token:
        return jsonify({"error": "Authentication required"}), 401

    username = get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return jsonify({"error": "Invalid session"}), 401

    try:
        # Get current following list
        following_json = get_hash(f"user_following{redis_version}", username)
        following_usernames = json.loads(following_json) if following_json else []
        
        # Get profile information for each followed user
        following_users = []
        for follow_username in following_usernames:
            follow_profile_json = get_hash(f"user_profiles{redis_version}", follow_username)
            if follow_profile_json:
                follow_profile = json.loads(follow_profile_json)
                following_users.append({
                    "username": follow_username,
                    "avatar_url": get_user_avatar_url(follow_username),
                    "profile": follow_profile
                })
        
        # Return both the simple username list (for compatibility) and the detailed user objects
        return jsonify({
            "following": following_usernames,
            "following_users": following_users
        })
    
    except Exception as e:
        logger.error(f"Error retrieving following list: {str(e)}")
        return jsonify({"error": "Failed to retrieve following list"}), 500

@app.route('/api/user/followers', methods=['GET'])
def get_user_followers():
    """Get the list of users that are following the current user"""
    auth_token = request.headers.get('Authorization')
    if not auth_token:
        return jsonify({"error": "Authentication required"}), 401

    username = get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return jsonify({"error": "Invalid session"}), 401

    try:
        # Get current followers list
        followers_json = get_hash(f"user_followers{redis_version}", username)
        followers = json.loads(followers_json) if followers_json else []
        
        return jsonify({
            "followers": followers
        })
    
    except Exception as e:
        logger.error(f"Error retrieving followers list: {str(e)}")
        return jsonify({"error": "Failed to retrieve followers list"}), 500

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

        # Get current following list
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
        
        # Log user activity
        user_logging.log_user_activity(
            username=username,
            action="favorite_song",
            song_id=track.get('song_id'),
            details={
                "title": track.get('title'),
                "artist": track.get('artist'),
                "favorites_room": favorites_room_name
            }
        )
        
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
        is_guest_pin = data.get('is_guest_pin', False)
        
        if not all([room_name, track_id]):
            return jsonify({"error": "Missing required parameters"}), 400
        
        # Get current playlist from Redis
        playlist_json = get_hash(f"room_playlists{redis_version}", room_name)
        if not playlist_json:
            return jsonify({"error": "Playlist not found"}), 404
        
        playlist = json.loads(playlist_json)
        
        # If this is a guest pin, verify user authentication and deduct coins
        if is_guest_pin:
            # Get auth token from header
            auth_header = request.headers.get('Authorization')
            if not auth_header:
                return jsonify({"error": "Authentication required for guest pinning"}), 401
            
            # Extract token from Authorization header
            auth_token = auth_header
            if auth_header.startswith('Bearer '):
                auth_token = auth_header[7:]  # Remove 'Bearer ' prefix
            
            # Get username from token
            username = get_hash(f"sessions{redis_version}", auth_token)
            if not username:
                return jsonify({"error": "Invalid session"}), 401
            
            # Get pin price for this room
            pin_price_key = f"room_pin_price{redis_version}"
            pin_price = get_hash(pin_price_key, room_name)
            
            # If no price is set, use default (10 coins)
            if not pin_price:
                pin_price = 10
            else:
                pin_price = int(pin_price)
            
            # Get room host
            room_host_data = get_hash(f"room_hosts{redis_version}", room_name)
            room_host = None
            
            # Parse host data - could be a string username or a JSON object
            if room_host_data:
                try:
                    # Try to parse as JSON
                    host_data = json.loads(room_host_data)
                    if isinstance(host_data, dict) and 'username' in host_data:
                        room_host = host_data['username']
                    else:
                        room_host = room_host_data
                except json.JSONDecodeError:
                    # If not JSON, assume it's just the username
                    room_host = room_host_data
                    
            if not room_host:
                return jsonify({"error": "Room host not found"}), 404
                
            # Use coins for pinning
            result = use_user_coins(
                username=username,
                amount=pin_price,
                feature=f"Pin track in room {room_name}"
            )
            
            if not result["success"]:
                return jsonify({
                    "error": "Insufficient coins",
                    "current_coins": result.get("coins", 0),
                    "required_coins": pin_price
                }), 400
            
            # Add 50% of the coins to the host's balance
            host_reward = pin_price // 2  # Integer division to get 50%
            if host_reward > 0 and room_host != username:  # Don't reward if pinning in own room
                add_user_coins(
                    username=room_host,
                    amount=host_reward,
                    reason=f"Reward for guest pinning track in room {room_name}"
                )
                
                # Log the host reward
                user_logging.log_user_activity(
                    username=room_host,
                    action="receive_pin_reward",
                    details={
                        "room_name": room_name,
                        "track_id": track_id,
                        "coins_received": host_reward,
                        "from_user": username
                    }
                )
            
            # Log the pin action
            user_logging.log_user_activity(
                username=username,
                action="pin_track",
                details={
                    "room_name": room_name,
                    "track_id": track_id,
                    "coins_used": pin_price,
                    "host_reward": host_reward
                }
            )
        else:
            # For host pins, verify that the user is the host
            auth_header = request.headers.get('Authorization')
            if auth_header:
                if auth_header.startswith('Bearer '):
                    auth_token = auth_header[7:]  # Remove 'Bearer ' prefix
                else:
                    auth_token = auth_header
                
                username = get_hash(f"sessions{redis_version}", auth_token)
                if username:
                    # Check if user is the host
                    room_host_data = get_hash(f"room_hosts{redis_version}", room_name)
                    room_host = None
                    
                    # Parse host data - could be a string username or a JSON object
                    if room_host_data:
                        try:
                            # Try to parse as JSON
                            host_data = json.loads(room_host_data)
                            if isinstance(host_data, dict) and 'username' in host_data:
                                room_host = host_data['username']
                            else:
                                room_host = room_host_data
                        except json.JSONDecodeError:
                            # If not JSON, assume it's just the username
                            room_host = room_host_data
                            
                    if room_host and room_host != username:
                        # Non-host users must use coins
                        return jsonify({"error": "Only the host can pin tracks without coins"}), 403
        
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

@app.route('/api/changelogs', methods=['GET'])
def get_changelogs():
    try:
        # Read the changelogs from the JSON file
        changelog_path = os.path.join(os.path.dirname(__file__), 'changelogs.json')
        with open(changelog_path, 'r') as file:
            changelogs_data = json.load(file)
        return jsonify(changelogs_data)
    except Exception as e:
        logging.error(f"Error fetching changelogs: {str(e)}")
        return jsonify({"error": "Failed to fetch changelogs"}), 500

# User Activity Logging Endpoints

@app.route('/api/user-activity/logs/user', methods=['GET'])
def get_user_logs():
    """Get activity logs for a specific user"""
    try:
        # Get auth token from request
        auth_token = request.headers.get('Authorization')
        if not auth_token:
            return jsonify({"error": "No token provided"}), 401
        
        # Get username from session
        username = get_hash(f"sessions{redis_version}", auth_token)
        if not username:
            return jsonify({"error": "Invalid session"}), 401

        # Get pagination parameters
        limit = int(request.args.get('limit', 50))
        start = int(request.args.get('start', 0))
        
        # Get logs for the user
        logs = user_logging.get_user_logs(username, start=start, limit=limit)
        
        return jsonify({
            "success": True,
            "logs": logs,
            "count": len(logs),
            "start": start,
            "limit": limit,
            "username": username
        })
    except Exception as e:
        logger.error(f"Error getting user logs: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/user-activity/logs/global', methods=['GET'])
def get_global_logs():
    """Get global activity logs for all users"""
    try:
        # Get auth token from request
        auth_token = request.headers.get('Authorization')
        if not auth_token:
            return jsonify({"error": "No token provided"}), 401
        
        # Get username from session
        username = get_hash(f"sessions{redis_version}", auth_token)
        if not username:
            return jsonify({"error": "Invalid session"}), 401

        # Check if user is admin (you may need to implement this check based on your user roles system)
        profile_json = get_hash(f"user_profiles{redis_version}", username)
        if not profile_json:
            return jsonify({"error": "User profile not found"}), 404
            
        profile = json.loads(profile_json)
        is_admin = profile.get('is_admin', False)
        
        if not is_admin and username not in ADMIN_USERS:
            return jsonify({"error": "Unauthorized access"}), 403
        
        # Get pagination parameters
        limit = int(request.args.get('limit', 50))
        start = int(request.args.get('start', 0))
        
        # Get global logs
        logs = user_logging.get_global_logs(start=start, limit=limit)
        
        return jsonify({
            "success": True,
            "logs": logs,
            "count": len(logs),
            "start": start,
            "limit": limit
        })
    except Exception as e:
        logger.error(f"Error getting global logs: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/user-activity/logs/room/<room_name>', methods=['GET'])
def get_room_logs(room_name):
    """Get activity logs for a specific room"""
    try:
        # Get auth token from request
        auth_token = request.headers.get('Authorization')
        if not auth_token:
            return jsonify({"error": "No token provided"}), 401
        
        # Get username from session
        username = get_hash(f"sessions{redis_version}", auth_token)
        if not username:
            return jsonify({"error": "Invalid session"}), 401
        
        # Get pagination parameters
        limit = int(request.args.get('limit', 50))
        start = int(request.args.get('start', 0))
        
        # Get logs for the room
        logs = user_logging.get_room_logs(room_name, start=start, limit=limit)
        
        return jsonify({
            "success": True,
            "logs": logs,
            "count": len(logs),
            "start": start,
            "limit": limit,
            "room_name": room_name
        }), 200
    except Exception as e:
        logger.error(f"Error getting room logs: {str(e)}")
        return jsonify({"error": str(e)}), 500

# # Helper function to check admin status
# def check_admin_status():
#     """Check if the current user has admin status"""
#     try:
#         # Get auth token from request
#         auth_header = request.headers.get('Authorization')
#         if not auth_header:
#             logger.warning("Admin check: No token provided")
#             return False, jsonify({"error": "No token provided"}), 401
        
#         # Extract token from Bearer format
#         if auth_header.startswith('Bearer '):
#             auth_token = auth_header[7:]  # Remove 'Bearer ' prefix
#         else:
#             auth_token = auth_header
            
#         logger.info(f"Admin check: Processing token: {auth_token[:10]}...")
        
#         # Get username from session
#         # redis_version = os.environ.get('REDIS_VERSION', '')
#         username = redis_api.get_hash(f"sessions{redis_version}", auth_token)
#         logger.info(f"Admin check: Username from token: {username}")
        
#         if not username:
#             logger.warning(f"Admin check: Invalid or expired token: {auth_token[:10]}...")
#             return False, jsonify({"error": "Invalid or expired token"}), 401
        
#         # Check if user is in admin list
#         if username in ADMIN_USERS:
#             logger.info(f"Admin check: {username} is in admin list")
#             return True, username, None
        
#         # Check user data for admin status
#         user_data = redis_api.get_user_data(username)
#         is_admin = user_data.get('is_admin', False)
        
#         if not is_admin:
#             logger.warning(f"Admin check: {username} is not an admin")
#             return False, jsonify({"error": "Unauthorized access"}), 403
        
#         logger.info(f"Admin check: {username} is an admin from user data")
#         return True, username, None
#     except Exception as e:
#         logger.error(f"Error checking admin status: {str(e)}")
#         return False, jsonify({"error": str(e)}), 500

# # Admin Dashboard API Endpoints
# @app.route('/api/user-activity/export/song-interactions', methods=['GET'])
# def export_song_interactions():
#     """Export song interactions data for admin dashboard"""
#     logger.info("Admin endpoint: Exporting song interactions")
    
#     # Check admin status
#     is_admin, response, status_code = check_admin_status()
#     if not is_admin:
#         return response, status_code
    
#     # Return dummy data for testing
#     return jsonify({
#         "success": True,
#         "data": [
#             {
#                 "song_id": "youtube_dQw4w9WgXcQ",
#                 "title": "Rick Astley - Never Gonna Give You Up",
#                 "username": "vincentliux",
#                 "action": "play",
#                 "timestamp": "2025-03-19T10:30:00"
#             },
#             {
#                 "song_id": "youtube_9bZkp7q19f0",
#                 "title": "PSY - GANGNAM STYLE",
#                 "username": "vincentliux",
#                 "action": "favorite",
#                 "timestamp": "2025-03-19T11:15:00"
#             },
#             {
#                 "song_id": "youtube_kJQP7kiw5Fk",
#                 "title": "Luis Fonsi - Despacito ft. Daddy Yankee",
#                 "username": "user123",
#                 "action": "add",
#                 "timestamp": "2025-03-19T12:00:00"
#             }
#         ]
#     })

# @app.route('/api/user-activity/export/room-interactions', methods=['GET'])
# def export_room_interactions():
#     """Export room interactions data for admin dashboard"""
#     logger.info("Admin endpoint: Exporting room interactions")
    
#     # Check admin status
#     is_admin, response, status_code = check_admin_status()
#     if not is_admin:
#         return response, status_code
    
#     # Return dummy data for testing
#     return jsonify({
#         "success": True,
#         "data": [
#             {
#                 "room_name": "Marvel",
#                 "username": "vincentliux",
#                 "action": "join_room",
#                 "timestamp": "2025-03-19T09:30:00"
#             },
#             {
#                 "room_name": "favorites_vincentliux",
#                 "username": "vincentliux",
#                 "action": "create_room",
#                 "timestamp": "2025-03-19T09:41:04"
#             },
#             {
#                 "room_name": "Marvel",
#                 "username": "user123",
#                 "action": "favorite_room",
#                 "timestamp": "2025-03-19T10:15:00"
#             }
#         ]
#     })

# @app.route('/api/user-activity/export/song-features', methods=['GET'])
# def export_song_features():
#     """Export song features data for admin dashboard"""
#     logger.info("Admin endpoint: Exporting song features")
    
#     # Check admin status
#     is_admin, response, status_code = check_admin_status()
#     if not is_admin:
#         return response, status_code
    
#     # Return dummy data for testing
#     return jsonify({
#         "success": True,
#         "data": [
#             {
#                 "song_id": "youtube_dQw4w9WgXcQ",
#                 "title": "Rick Astley - Never Gonna Give You Up",
#                 "play_count": 42,
#                 "favorite_count": 15,
#                 "add_count": 20,
#                 "remove_count": 5
#             },
#             {
#                 "song_id": "youtube_9bZkp7q19f0",
#                 "title": "PSY - GANGNAM STYLE",
#                 "play_count": 38,
#                 "favorite_count": 12,
#                 "add_count": 18,
#                 "remove_count": 3
#             },
#             {
#                 "song_id": "youtube_kJQP7kiw5Fk",
#                 "title": "Luis Fonsi - Despacito ft. Daddy Yankee",
#                 "play_count": 35,
#                 "favorite_count": 10,
#                 "add_count": 15,
#                 "remove_count": 2
#             }
#         ]
#     })

# @app.route('/api/user-activity/export/room-features', methods=['GET'])
# def export_room_features():
#     """Export room features data for admin dashboard"""
#     logger.info("Admin endpoint: Exporting room features")
    
#     # Check admin status
#     is_admin, response, status_code = check_admin_status()
#     if not is_admin:
#         return response, status_code
    
#     # Return dummy data for testing
#     return jsonify({
#         "success": True,
#         "data": [
#             {
#                 "room_name": "Marvel",
#                 "join_count": 25,
#                 "favorite_count": 10,
#                 "song_count": 15,
#                 "host": "vincentliux"
#             },
#             {
#                 "room_name": "favorites_vincentliux",
#                 "join_count": 15,
#                 "favorite_count": 8,
#                 "song_count": 12,
#                 "host": "vincentliux"
#             },
#             {
#                 "room_name": "Chill Vibes",
#                 "join_count": 20,
#                 "favorite_count": 12,
#                 "song_count": 18,
#                 "host": "user123"
#             }
#         ]
#     })

# @app.route('/api/user-activity/export/dataset', methods=['GET'])
# def export_recommendation_dataset():
#     """Export complete dataset for recommendation system"""
#     logger.info("Admin endpoint: Exporting recommendation dataset")
    
#     # Check admin status
#     is_admin, response, status_code = check_admin_status()
#     if not is_admin:
#         return response, status_code
    
#     # Return success message for testing
#     return jsonify({
#         "success": True,
#         "message": "Dataset export initiated. Download will start shortly."
#     })

@app.route('/api/songs/log-play', methods=['POST'])
def log_song_play():
    """Log when a user plays a song"""
    try:
        data = request.json
        song_id = data.get('song_id')
        song_title = data.get('title')
        song_artist = data.get('artist')
        room_name = data.get('room_name')
        username = data.get('username', 'vincentliux')  # Default to vincentliux for testing
        
        # Get user from auth token
        auth_token = request.headers.get('Authorization')
        if auth_token:
            # Extract token from Bearer format
            if auth_token.startswith('Bearer '):
                auth_token = auth_token[7:]  # Remove 'Bearer ' prefix
            
            token_username = get_hash(f"sessions{redis_version}", auth_token)
            if token_username:
                username = token_username
        
        # Log the play action
        logger.info(f"Logging play_song for user {username}, song {song_title} in room {room_name}")
        user_logging.log_user_activity(
            username=username,
            action="play_song",
            room_name=room_name,
            song_id=song_id,
            details={
                "title": song_title,
                "artist": song_artist
            }
        )
        
        # Increment play count in Redis
        new_count = redis_api.increment_song_play_count(song_id, title=song_title, artist=song_artist)
        logger.info(f"Incremented play count for song {song_id} to {new_count}")
        
        return jsonify({
            "success": True,
            "message": "Song play logged successfully",
            "play_count": new_count
        })
    except Exception as e:
        logger.error(f"Error logging song play: {str(e)}")
        return jsonify({"error": str(e)}), 500

def format_user_profile(username, profile=None):
    """Format a user profile with consistent avatar URL."""
    if not profile:
        profile_json = get_hash(f"user_profiles{redis_version}", username)
        if profile_json:
            profile = json.loads(profile_json)
        else:
            profile = {"username": username}
    
    # Add avatar URL
    profile["avatar_url"] = get_user_avatar_url(username)
    
    # Add coins using the unified coin management system
    profile["coins"] = get_user_coins(username)
    
    return profile

def get_user_avatar_url(username):
    """Get the avatar URL for a user."""
    # Find the most recent avatar file for this user
    try:
        avatar_files = list(AVATARS_DIR.glob(f"{username}_*.jpg"))
        if avatar_files:
            # Get the most recent file
            latest_avatar = max(avatar_files, key=lambda x: x.stat().st_mtime)
            filename = latest_avatar.name
            return f"/api/avatar/{username}"
    except Exception as e:
        logger.error(f"Error getting avatar URL for {username}: {str(e)}")
    
    # If no uploaded avatar or error, return the default avatar URL
    return f"/api/avatar/{username}"

# def set_room_host(room_name, username, avatar, update_timestamp=True):
#     """Set or update the host of a room.
    
#     Args:
#         room_name: The name of the room
#         username: The username of the host
#         avatar: The avatar URL of the host
#         update_timestamp: Whether to update the last_host_update timestamp (default: True)
#     """
#     try:
#         room_json = get_hash(f"rooms{redis_version}", room_name)
#         if not room_json:
#             return
        
#         room = json.loads(room_json)
#         room["host"] = {
#             "username": username,
#             "avatar_url": get_user_avatar_url(username)
#         }
        
#         if update_timestamp:
#             room["last_host_update"] = datetime.now().isoformat()
        
#         write_hash(f"rooms{redis_version}", room_name, json.dumps(room))
        
#     except Exception as e:
#         logger.error(f"Error setting room host: {str(e)}")

# Google OAuth Authentication
@app.route('/api/auth/google', methods=['POST'])
def google_login():
    """Handle Google OAuth authentication."""
    try:
        data = request.json
        credential = data.get('credential')
        user_info = data.get('user_info', {})
        
        if not credential:
            return jsonify({"error": "No Google credential provided"}), 400
        
        # Extract user information from the credential
        try:
            # Decode the JWT token (fallback to manual decode if jwt.decode is unavailable)
            try:
                decoded = jwt.decode(credential, options={"verify_signature": False})
            except AttributeError:
                import base64
                header, payload, signature = credential.split('.')
                # Add padding to payload for base64 decoding
                padded = payload + '=' * (-len(payload) % 4)
                decoded_bytes = base64.urlsafe_b64decode(padded)
                decoded = json.loads(decoded_bytes)
            
            # Extract user information
            email = decoded.get('email') or user_info.get('email')
            name = decoded.get('name') or user_info.get('name')
            picture = decoded.get('picture') or user_info.get('picture')
            
            logger.info(f"Google login attempt for email: {email}")
            
            if not email:
                return jsonify({"error": "No email found in Google credentials"}), 400
                
            # Generate username from email (remove domain part)
            username = email.split('@')[0]
            
            # Check if user already exists
            user_exists = get_hash(f"users{redis_version}", username)
            
            # Get user agent and IP for logging
            user_agent = request.headers.get('User-Agent', 'Unknown')
            ip_address = request.remote_addr
            
            if not user_exists:
                # Create new user profile
                profile = {
                    "username": username,
                    "email": email,
                    "created_at": datetime.now().isoformat(),
                    "has_avatar": False,  # Initialize with no avatar
                    "google_user": True,
                    "google_picture": picture
                }
                
                # Store user profile in user_profiles{redis_version}
                write_hash(f"user_profiles{redis_version}", username, json.dumps(profile))
                
                # Store a placeholder password hash for Google users
                # This ensures consistency with regular user accounts
                google_password_hash = hash_password(f"google_auth_{secrets.token_hex(16)}")
                write_hash(f"users{redis_version}", username, google_password_hash)
                
                # Set initial coins using the unified coin management system
                set_user_coins(username, 1000, "Initial allocation for new Google user")
                
                # Log user registration
                user_logging.log_user_activity(
                    username=username,
                    action="register",
                    details={"method": "google", "user_agent": user_agent, "ip_address": ip_address}
                )
                
                logger.info(f"Created new user account for Google user: {username}")
            else:
                # Get existing user profile
                profile_json = get_hash(f"user_profiles{redis_version}", username)
                
                if profile_json:
                    profile = json.loads(profile_json)
                else:
                    # Create default profile if it doesn't exist
                    profile = {
                        "username": username,
                        "email": email,
                        "created_at": datetime.now().isoformat(),
                        "has_avatar": False
                    }
                
                # Update Google-specific information
                profile["google_user"] = True
                profile["google_picture"] = picture
                
                # Update user profile in Redis
                write_hash(f"user_profiles{redis_version}", username, json.dumps(profile))
                
                logger.info(f"Updated existing user account for Google user: {username}")
            
            # Generate session token
            session_token = secrets.token_urlsafe(32)
            redis_api.write_hash(f"sessions{redis_version}", session_token, username)
            
            # Log user login
            user_logging.log_user_activity(
                username=username,
                action="login",
                details={"method": "google", "user_agent": user_agent, "ip_address": ip_address}
            )
            
            # Get the coins using the unified coin management system
            profile["coins"] = get_user_coins(username)
            
            return jsonify({
                "token": session_token,
                "user": profile
            })
            
        except Exception as e:
            logger.error(f"Error processing Google credentials: {str(e)}")
            return jsonify({"error": f"Error processing Google credentials: {str(e)}"}), 500
    
    except Exception as e:
        logger.error(f"Google login error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/health')
def health_check():
    """Simple health check endpoint."""
    logger.info("Health check endpoint called")
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    # app.run(port=3000, host='10.72.252.213', debug=True)
     socketio.run(app, port=5000, host='0.0.0.0', debug=True)    # http://13.56.253.58/

# @app.route('/images/<path:filename>')
def serve_image_file(filename):
    """
    Serve image files from the frontend build/images directory.
    This endpoint handles requests to /images/* paths.
    
    Args:
        filename: The name of the image file to serve
        
    Returns:
        The requested image file
    """
    logger.info(f"Serving image: {filename}")
    images_dir = Path(__file__).parent.parent / 'frontend' / 'react_dj' / 'build' / 'images'
    
    # Create the directory if it doesn't exist
    images_dir.mkdir(parents=True, exist_ok=True)
    
    # Also check the public directory as a fallback
    public_images_dir = Path(__file__).parent.parent / 'frontend' / 'react_dj' / 'public' / 'images'
    
    # First try to serve from build/images
    if (images_dir / filename).exists():
        return send_from_directory(images_dir, filename)
    # Then try to serve from public/images
    elif (public_images_dir / filename).exists():
        return send_from_directory(public_images_dir, filename)
    else:
        logger.error(f"Image not found: {filename}")
        return jsonify({"error": "Image not found"}), 404

# @app.route('/api/avatars/<path:filename>')
def serve_avatar_file(filename):
    """Serve an avatar file from the avatars directory."""
    logger.info(f"Serving avatar file: {filename}")
    try:
        # First check the backend avatars directory
        logger.info(f"Checking backend avatars directory: {AVATARS_DIR / filename}")
        if (AVATARS_DIR / filename).exists():
            # return send_from_directory(str(AVATARS_DIR), filename)
            avatar_file = AVATARS_DIR / filename
            return send_file(
                        str(avatar_file),
                        mimetype='image/jpeg',
                        last_modified=avatar_file.stat().st_mtime,
                        max_age=31536000  # Cache for 1 year
                    )

        
        # Then check the frontend static avatars directory
        frontend_dir = Path(__file__).parent.parent / 'frontend' / 'react_dj' / 'build' / 'static' / 'avatars'
        logger.info(f"Checking frontend avatars directory: {frontend_dir / filename}")
        if (frontend_dir / filename).exists():
            return send_file(
                str(frontend_dir / filename),
                mimetype='image/jpeg',
                last_modified=(frontend_dir / filename).stat().st_mtime,
                max_age=31536000  # Cache for 1 year
            )
        
        # If not found, log a warning and return 404
        logger.warning(f"Avatar file not found: {filename}")
        return "Avatar not found", 404
    except Exception as e:
        logger.error(f"Error serving avatar file {filename}: {str(e)}")
        return "Error serving avatar", 500