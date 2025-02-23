from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import gpt
from pathlib import Path
import spotify
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

log_path = Path(__file__).parent.parent / "logs" / "backend.online.log"
logger_setup(log_path=log_path, debug=False)
logger = logging.getLogger(__name__)


redis_client = redis.Redis(host='localhost', port=6379, db=0)

redis_version = '_v1'

app = Flask(__name__)

# CORS(app)
CORS(app, resources={r"/api/*": {"origins": "*"}})  # Enable CORS for all API routes

def parse_answer_playlist(answer):
    results = answer.split("\n")
    titles = ''
    artists = ''
    introduction = ''
    
    start = -1
    for index, item in enumerate(results):
        if 'titles' in item.lower():
            titles =  ':'.join(item.split(":")[1:]).strip(' <>;')
            start = index
            break
        
    
    for index, item in enumerate(results):
        if index < start + 1:
            continue
        if 'artists' in item.lower():
            artists =  ':'.join(item.split(":")[1:]).strip(' <>;')
            start = index
            break

    for index, item in enumerate(results):
        if index < start + 1:
            continue
        if 'introduction' in item.lower():
            introduction =  ':'.join(item.split(":")[1:]).strip(' <>;')
            start = index
            break
        
    return titles, artists, introduction


@app.route('/api/generate-playlist', methods=['POST'])
def generate_playlist():
    start_time = time.time()
    data = request.json
    prompt = data.get('prompt')
    genre = data.get('genre')
    occasion = data.get('occasion')
    room_name = data.get('room_name')
    # room_name = 'test'


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
    final_prompt = f"""
    I'll give you a music requirement possibly with genre and an occasion, and you'll generate a playlist of at least {song_num} songs for me. Make sure the playlist is suitable for the given genre and occasion.
    The output format of the playlist should be two list seperated by ;. The two list titles and artists are stored in two lines in the below format. such that the title is and only is the full name of the song, and artist is and only is the full name of the corresponding musician. 
    Do not provide any extra information. Each one separated by a semicolon ;, and the sequence and item number should be matched.
    Provide a paragraph of introduction about why you choose these songs and artists, what are their styles and backgrounds.
    Make sure you strictly follow the music requirement, instead of recommend very general songs.

    Output Format:
    titles: <titles separated by ;>
    artists: <artists separated by ;>
    introduction: <a paragraph of introduction>
    
    Output Example:
    titles: music1;music2;music3;...;
    artists: artist1;artist2;artist3;...;
    introduction: This playlist is about ....

    Do not use new line when listing the titles and artists, but make them into one line.

    The given input is as followed:
    music requirement: {prompt}
    Genre: {genre}
    Occasion: {occasion}
    """
    logger.info('--- sending gpt request')
    # Generate the playlist using the GPT model
    # reply = gpt.gpt_single_reply(final_prompt)
    # reply = gpt.query_perplexity(final_prompt)
    reply = gpt.personal_gpt(final_prompt)
    
    logger.info(reply)
    # reply = gpt.query_perplexity(prompt)

    titles, artists, introduction = parse_answer_playlist(reply)
    
    logger.info(str(titles))
    logger.info(str(artists))
    logger.info(str(introduction))
    
    titles = titles.split(';')
    artists = artists.split(';')
    
    urls = []
    ids = []
    cover_img_urls = []
    playlist = []
    # for title, artist in zip(titles, artists):
    #     try:
    #         logger.info(f'getting links for {title}...')
    #         # url, id = spotify.get_song_url(artist, title)
    #         song_info = youtube_music.get_song_info(song_name=title, artist_name=artist)
    #         url, id, cover_img_url = song_info['song_url'], song_info['song_id'], song_info['cover_img_url']

    #     except Exception as e:
    #         logger.info(f'----failed for {title}, {artist}', e)
    #         url = ''
    #         id = ''
    #         cover_img_url = ''
    #     urls.append(url)
    #     ids.append(id)
    #     cover_img_urls.append(cover_img_url)

    # # playlist = [{"title": title, "artist": artist, "url": url, "id": id} for title, artist, url, id in zip(titles, artists, urls, ids)]
    # playlist = [{"title": title, "artist": artist, "url": url, "id": id, "cover_img_url": cover_img_url} for title, artist, url, id, cover_img_url in zip(titles, artists, urls, ids, cover_img_urls)]

    for title, artist in zip(titles, artists):
        try:
            logger.info(f'getting links for {title}...')
            song_info = youtube_music.get_song_info(song_name=title, artist_name=artist)
            playlist.append(song_info)

        except Exception as e:
            logger.info(f'----failed for {title}, {artist}', e)
    
    logger.info(str(playlist))

    # # Store the playlist in Redis
    # redis_client.set(f"playlist:{room_name}", json.dumps(playlist))
    # redis_client.set(f"settings:{room_name}", json.dumps(settings))
    # redis_client.set(f"intro:{room_name}", introduction)

    redis_api.write_hash(f"playlist{redis_version}", room_name, json.dumps(playlist))
    redis_api.write_hash(f"settings{redis_version}", room_name, json.dumps(settings))
    redis_api.write_hash(f"intro{redis_version}", room_name, introduction)

    logger.info(f'Time taken: {time.time() -  start_time}')
    # logger.info(urls)
    
    # Here you would implement your playlist generation logic
    # For now, we'll return a dummy playlist
    # playlist = [
    #     {"title": "Song 1", "artist": "Artist 1", "url": "xxx"},
    #     {"title": "Song 2", "artist": "Artist 2", "url": "xxx"},
    # ]
    
    return jsonify({"playlist": playlist})


@app.route('/api/room-playlist', methods=['GET'])
def get_room_playlist():
    room_name = request.args.get('room_name')
    # Fetch the playlist for the given room_name from your database
    # For now, we'll return a dummy playlist

# Only generate QR code if it doesn't exist
    qr_code_path = Path(__file__).parent.parent / 'frontend' / 'react_dj' / 'public' / 'images' / f"qr_code_{room_name}.png"
    if not qr_code_path.exists():
        generate_qr_code_with_logo(f'http://aico-music.com/playroom?room_name={room_name}', qr_code_path)
        
        build_path = Path(__file__).parent.parent / 'frontend' / 'react_dj' / 'build' / 'images' / f"qr_code_{room_name}.png"
        generate_qr_code_with_logo(f'http://aico-music.com/playroom?room_name={room_name}', build_path)


    
    # playlist_json = redis_client.get(f"playlist:{room_name}")
    # settings_json = redis_client.get(f"settings:{room_name}")
    # introduction = redis_client.get(f"intro:{room_name}")

    # # Decode settings_json and playlist_json from bytes to str before using json.loads()
    # if settings_json:
    #     settings = json.loads(settings_json.decode('utf-8'))
    # else:
    #     settings = {}

    # if playlist_json:
    #     playlist = json.loads(playlist_json.decode('utf-8'))
    # else:
    #     # Return an empty playlist if not found
    #     playlist = []

    # # Decode introduction from bytes to str if it exists
    # if introduction:
    #     introduction = introduction.decode('utf-8')
    # else:
    #     introduction = ""

    playlist = json.loads(redis_api.get_hash(f"playlist{redis_version}", room_name))
    settings = json.loads(redis_api.get_hash(f"settings{redis_version}", room_name))
    introduction = redis_api.get_hash(f"intro{redis_version}", room_name)


    logger.info(str({
        "playlist": playlist,
        "introduction": introduction,
        "settings": settings
    }))
    # Now return the decoded and JSON-parsed data
    return jsonify({
        "playlist": playlist,
        "introduction": introduction,
        "settings": settings
    })

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

if __name__ == '__main__':
    # app.run(port=3000, host='10.72.252.213', debug=True)
    app.run(port=5000, host='0.0.0.0', debug=True)
    # http://13.56.253.58/