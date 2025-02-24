from flask import Flask, request, jsonify, send_file
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

from io import BytesIO
import random


import hashlib
import secrets
from util.redis_api import *

import redis
import json

from util.generation import *
from util.all_utils import *

import os
from werkzeug.utils import secure_filename
from PIL import Image
import io

log_path = Path(__file__).parent.parent / "logs" / "backend.online.log"
logger_setup(log_path=log_path, debug=False)
logger = logging.getLogger(__name__)


redis_client = redis.Redis(host='localhost', port=6379, db=0)

redis_version = '_v1'

app = Flask(__name__)

# CORS(app)
CORS(app, resources={r"/api/*": {"origins": "*"}})  # Enable CORS for all API routes



# Define base paths
BASE_DIR = Path(__file__).parent.parent  # This gets you to aico/
FRONTEND_DIR = BASE_DIR / 'frontend' / 'react_dj'
STATIC_DIR = FRONTEND_DIR / 'public' / 'static'
AVATARS_DIR = STATIC_DIR / 'avatars'

# Create directories if they don't exist
AVATARS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

# if not os.path.exists(UPLOAD_FOLDER):
#     os.makedirs(UPLOAD_FOLDER)

@app.route('/api/generate-playlist', methods=['POST'])
def generate_playlist():
    data = request.json
    prompt = data.get('prompt')
    genre = data.get('genre')
    occasion = data.get('occasion')
    room_name = data.get('room_name')
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

        settings = {
            "prompt": prompt,
            "genre": genre,
            "occasion": occasion
        }

        song_num = 20
        titles, artists, introduction, reply = llm.llm_generate_playlist(prompt, genre, occasion, song_num)
        
        playlist = []
        
        for title, artist in zip(titles, artists):
            try:
                logger.info(f'getting links for {title}...')
                song_info = youtube_music.get_song_info(song_name=title, artist_name=artist)
                playlist.append(song_info)

            except Exception as e:
                logger.info(f'----failed for {title}, {artist}', e)
        
        logger.info(str(playlist))

        redis_api.write_hash(f"playlist{redis_version}", room_name, json.dumps(playlist))
        redis_api.write_hash(f"settings{redis_version}", room_name, json.dumps(settings))
        redis_api.write_hash(f"intro{redis_version}", room_name, introduction)

        # logger.info(f'Time taken: {time.time() -  start_time}')

        # Store host information if user is logged in
        if username and avatar:
            set_room_host(room_name, username, avatar)
            add_room_to_user_profile(username, room_name)

        return jsonify({"playlist": playlist})
    except Exception as e:
        logger.error(f"Error generating playlist: {str(e)}")
        return jsonify({"error": "Failed to generate playlist"}), 500


@app.route('/api/room-playlist', methods=['GET'])
def get_room_playlist():
    room_name = request.args.get('room_name')

    # Only generate QR code if it doesn't exist
    qr_code_path = Path(__file__).parent.parent / 'frontend' / 'react_dj' / 'public' / 'images' / f"qr_code_{room_name}.png"
    if not qr_code_path.exists():
        generate_qr_code_with_logo(f'http://aico-music.com/playroom?room_name={room_name}', qr_code_path)
        
        build_path = Path(__file__).parent.parent / 'frontend' / 'react_dj' / 'build' / 'images' / f"qr_code_{room_name}.png"
        generate_qr_code_with_logo(f'http://aico-music.com/playroom?room_name={room_name}', build_path)

    try:
        # Get existing playlist data
        playlist = json.loads(get_hash(f"playlist{redis_version}", room_name))
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
        results = youtube_music.search_artist_tracks(query, max_results=30)
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

    playlist = json.loads(redis_api.get_hash(f"playlist{redis_version}", room_name))

    # Add the new track to the playlist
    playlist.append(track)
    logger.info(f'added track:{track} in room:{room_name}')
    logger.info(f'new playlist:{playlist}')

    # Update the playlist in Redis
    # redis_client.set(f"playlist:{room_name}", json.dumps(playlist))
    
    redis_api.write_hash(f"playlist{redis_version}", room_name, json.dumps(playlist))


    return jsonify({"message": "Track added successfully"})

@app.route('/api/remove-from-playlist', methods=['POST'])
def remove_from_playlist():
    data = request.json
    room_name = data.get('room_name')
    track_id = data.get('track_id')

    # Fetch the existing playlist for the given room_name
    playlist = json.loads(redis_api.get_hash(f"playlist{redis_version}", room_name))

    # Find and remove the track with the matching song_id instead of id
    updated_playlist = [track for track in playlist if track.get('song_id') != track_id]
    
    # Log the removal operation
    logger.info(f'removed track with song_id:{track_id} from room:{room_name}')
    logger.info(f'new playlist:{updated_playlist}')

    # Update the playlist in Redis
    redis_api.write_hash(f"playlist{redis_version}", room_name, json.dumps(updated_playlist))

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
    avatar_url = f"http://13.56.253.58:5000/api/avatar/{username}"
    
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
        avatar_url = f"http://13.56.253.58:5000/api/avatar/{username}"
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

def set_room_host(room_name, username, avatar):
    """Set room host information."""
    host_data = json.dumps({
        "username": username,
        "avatar": avatar,
        "created_at": datetime.now().isoformat()
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
        # Get user profile to find created rooms
        profile_json = get_hash(f"user_profiles{redis_version}", username)
        if not profile_json:
            return jsonify({"rooms": []})
        
        profile = json.loads(profile_json)
        created_rooms = profile.get('created_rooms', [])
        
        rooms_data = []
        for room_name in created_rooms:
            # Get room data
            playlist_json = get_hash(f"playlist{redis_version}", room_name)
            settings_json = get_hash(f"settings{redis_version}", room_name)
            intro = get_hash(f"intro{redis_version}", room_name)
            
            if not playlist_json:
                continue  # Skip if room no longer exists
                
            playlist = json.loads(playlist_json)
            settings = json.loads(settings_json) if settings_json else {}
            
            # Get first song's cover image as room cover
            cover_image = (playlist[0].get('cover_img_url', '') 
                         if playlist and len(playlist) > 0 
                         else '')
            
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
        
    except Exception as e:
        logger.error(f"Error fetching user rooms: {str(e)}")
        return jsonify({"error": "Failed to fetch rooms"}), 500


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

        return jsonify({"message": f"Successfully {action}ed room to favorites"})

    except Exception as e:
        logger.error(f"Error in favorite operation: {str(e)}")
        return jsonify({"error": "Operation failed"}), 500


# Add to your app.py

def format_user_profile(username, profile_data=None):
    """Helper function to format user profile data with defaults"""
    if not profile_data:
        profile_data = {}
    
    return {
        "username": username,
        "age": profile_data.get('age'),
        "country": profile_data.get('country', ''),
        "sex": profile_data.get('sex', ''),
        "bio": profile_data.get('bio', ''),
        "email": profile_data.get('email', ''),
        "avatar": profile_data.get('avatar', f"http://13.56.253.58:5000/api/avatar/{username}"),
        "tags": profile_data.get('tags', []),
        "created_at": profile_data.get('created_at', datetime.now().isoformat()),
        "stats": {
            "favoritesCount": 0,
            "followingCount": 0,
            "followersCount": 0
        }
    }

@app.route('/api/user/profile', methods=['GET'])
def get_user_profile():
    """Get user profile data including stats and tags"""
    auth_token = request.headers.get('Authorization')
    if not auth_token:
        return jsonify({"error": "Authentication required"}), 401

    username = get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return jsonify({"error": "Invalid session"}), 401

    try:
        # Get basic profile data
        profile_json = get_hash(f"user_profiles{redis_version}", username)
        profile = json.loads(profile_json) if profile_json else format_user_profile(username)
        
        # Get follower counts
        followers = get_hash(f"user_followers{redis_version}", username)
        following = get_hash(f"user_following{redis_version}", username)
        favorites = get_hash(f"user_favorites{redis_version}", username)
        
        followers_count = len(json.loads(followers)) if followers else 0
        following_count = len(json.loads(following)) if following else 0
        favorites_count = len(json.loads(favorites)) if favorites else 0

        # Get user tags
        user_tags_json = get_hash(f"user_tags{redis_version}", username)
        if user_tags_json:
            profile['tags'] = json.loads(user_tags_json)

        # Update stats
        profile["stats"] = {
            "favoritesCount": favorites_count,
            "followingCount": following_count,
            "followersCount": followers_count
        }

        return jsonify(profile)

    except Exception as e:
        logger.error(f"Error fetching user profile: {str(e)}")
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
        
        return jsonify({"message": "Profile updated successfully", "profile": profile})

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
    """Get paginated list of all rooms"""
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 12))
        offset = (page - 1) * limit

        # Get all rooms and their playlists
        all_rooms = get_all_hash(f"playlist{redis_version}")
        
        all_room_names = list(all_rooms.keys())
        logger.info(f"all_room_names:{all_room_names}")
        total_rooms = len(all_room_names)

        # Get paginated room names
        paginated_room_names = all_room_names[offset:offset + limit]
        rooms = []

        for room_name in paginated_room_names:
            try:
                # Get playlist data
                playlist = json.loads(all_rooms[room_name])
                
                # Get additional room data
                settings_json = get_hash(f"settings{redis_version}", room_name)
                intro = get_hash(f"intro{redis_version}", room_name)
                host_data = get_room_host(room_name)

                settings = json.loads(settings_json) if settings_json else {}
                
                # Get first song's cover image as room cover
                cover_image = (playlist[0].get('cover_img_url', '')
                             if playlist and len(playlist) > 0
                             else '')

                room_data = {
                    "name": room_name,
                    "cover_image": cover_image,
                    "introduction": intro,
                    "song_count": len(playlist),
                    "genre": settings.get('genre', ''),
                    "occasion": settings.get('occasion', ''),
                    "host": host_data
                }
                rooms.append(room_data)
            except Exception as e:
                logger.error(f"Error processing room {room_name}: {str(e)}")
                continue

        res = {
            "rooms": rooms,
            "total": total_rooms,
            "hasMore": offset + limit < total_rooms
        }
        logger.info(str(res))
        return jsonify({
            "rooms": rooms,
            "total": total_rooms,
            "hasMore": offset + limit < total_rooms
        })

    except Exception as e:
        logger.error(f"Error fetching explore rooms: {str(e)}")
        return jsonify({"error": "Failed to fetch rooms"}), 500


def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


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
        
        # Generate URL - use relative path from public directory
        avatar_url = f"/static/avatars/{filename}"
        
        # Update user profile in Redis
        profile_json = get_hash(f"user_profiles{redis_version}", username)
        profile = json.loads(profile_json) if profile_json else {}
        profile['avatar'] = avatar_url
        write_hash(f"user_profiles{redis_version}", username, json.dumps(profile))
        
        return jsonify({
            "message": "Avatar uploaded successfully",
            "avatar_url": avatar_url
        })

    except Exception as e:
        logger.error(f"Error uploading avatar: {str(e)}")
        return jsonify({"error": "Failed to process image"}), 500

# Add route to serve static files (if needed)
@app.route('/static/avatars/<path:filename>')
def serve_avatar(filename):
    return send_from_directory(str(AVATARS_DIR), filename)



if __name__ == '__main__':
    # app.run(port=3000, host='10.72.252.213', debug=True)
    app.run(port=5000, host='0.0.0.0', debug=True)
    # http://13.56.253.58/