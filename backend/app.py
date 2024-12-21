from flask import Flask, request, jsonify
from flask_cors import CORS
import gpt
from pathlib import Path
import spotify
import time
import logging


import redis
import json

from util.generation import *
from util.all_utils import *

log_path = Path(__file__).parent.parent / "logs" / "backend.online.log"
logger_setup(log_path=log_path, debug=False)
logger = logging.getLogger(__name__)


redis_client = redis.Redis(host='localhost', port=6379, db=0)


app = Flask(__name__)

CORS(app)

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

    final_prompt = f"""
    I'll give you a music requirement possibly with genre and an occasion, and you'll generate a playlist of at least 10 songs for me. Make sure the playlist is suitable for the given genre and occasion.
    The output format of the playlist should be two list seperated by ;. The two list titles and artists are stored in two lines in the below format. such that the title is and only is the full name of the song, and artist is and only is the full name of the corresponding musician. 
    Do not provide any extra information. Each one separated by a semicolon ;, and the sequence and item number should be matched.
    Provide a paragraph of introduction about why you choose these songs and artists, what are their styles and backgrounds.

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
    for title, artist in zip(titles, artists):
        try:
            logger.info(f'getting links for {title}...')
            url, id = spotify.get_song_url(artist, title)
        except Exception as e:
            logger.info(f'----failed for {title}, {artist}', e)
            url = ''
            id = ''
        urls.append(url)
        ids.append(id)
    playlist = [{"title": title, "artist": artist, "url": url, "id": id} for title, artist, url, id in zip(titles, artists, urls, ids)]
    
    logger.info(str(playlist))

    # Store the playlist in Redis
    redis_client.set(f"playlist:{room_name}", json.dumps(playlist))
    redis_client.set(f"settings:{room_name}", json.dumps(settings))
    redis_client.set(f"intro:{room_name}", introduction)

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


    
    playlist_json = redis_client.get(f"playlist:{room_name}")
    settings_json = redis_client.get(f"settings:{room_name}")
    introduction = redis_client.get(f"intro:{room_name}")

    # Decode settings_json and playlist_json from bytes to str before using json.loads()
    if settings_json:
        settings = json.loads(settings_json.decode('utf-8'))
    else:
        settings = {}

    if playlist_json:
        playlist = json.loads(playlist_json.decode('utf-8'))
    else:
        # Return an empty playlist if not found
        playlist = []

    # Decode introduction from bytes to str if it exists
    if introduction:
        introduction = introduction.decode('utf-8')
    else:
        introduction = ""

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
    tracks, json_result = spotify.search_spotify(query)

    # Get the first 30 tracks from the search results, each track should have title, artist, url, id, image url
    tracks = tracks[:30]

    # Extract required information for each track
    results = [{
        "title": track.get('name'),
        "artist": track['artists'][0]['name'] if track.get('artists') else "Unknown Artist",
        "url": track['external_urls']['spotify'] if track.get('external_urls') else "",
        "id": track.get('id'),
        "image_url": track['album']['images'][0]['url'] if track.get('album') and track['album'].get('images') else ""
    } for track in tracks]

    return jsonify({"tracks": results})


@app.route('/api/add-to-playlist', methods=['POST'])
def add_to_playlist():
    data = request.json
    room_name = data.get('room_name')
    track = data.get('track')

    # Fetch the existing playlist for the given room_name from Redis
    playlist_json = redis_client.get(f"playlist:{room_name}")
    if playlist_json:
        playlist = json.loads(playlist_json.decode('utf-8'))
    else:
        playlist = []

    # Add the new track to the playlist
    playlist.append(track)

    # Update the playlist in Redis
    redis_client.set(f"playlist:{room_name}", json.dumps(playlist))

    return jsonify({"message": "Track added successfully"})


if __name__ == '__main__':
    # app.run(port=3000, host='10.72.252.213', debug=True)
    app.run(port=5000, host='0.0.0.0', debug=True)
    # http://13.56.253.58/