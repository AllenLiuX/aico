from flask import Flask, request, jsonify
from flask_cors import CORS
import gpt
from pathlib import Path
import spotify
import time

import redis
import json

from util.generation import *


redis_client = redis.Redis(host='localhost', port=6379, db=0)


app = Flask(__name__)

CORS(app)

def parse_answer_playlist(answer):
    results = answer.split("\n")
    titles = ''
    artists = ''
    
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
        
    return titles, artists


@app.route('/api/generate-playlist', methods=['POST'])
def generate_playlist():
    start_time = time.time()
    data = request.json
    prompt = data.get('prompt')
    genre = data.get('genre')
    occasion = data.get('occasion')
    room_name = data.get('room_name')
    # room_name = 'test'


    print(prompt)
    print(genre)
    print(occasion)
    print(room_name)

    final_prompt = f"""
    I'll give you a music requirement possibly with genre and an occasion, and you'll generate a playlist of at least 10 songs for me. Make sure the playlist is suitable for the given genre and occasion.
    The output format of the playlist should be two list seperated by ;. The two list titles and artists are stored in two lines in the below format. such that the title is and only is the full name of the song, and artist is and only is the full name of the corresponding musician. 
    do not provide any extra information. Each one separated by a semicolon ;, and the sequence and item number should be matched.

    Output Format:
    titles: <titles separated by ;>
    artists: <artists separated by ;>
    
    Output Example:
    titles: music1;music2;music3;...;
    artists: artist1;artist2;artist3;...;

    Do not use new line when listing the titles and artists, but make them into one line.

    The given input is as followed:
    music requirement: {prompt}
    Genre: {genre}
    Occasion: {occasion}
    """
    print('--- sending gpt request')
    # Generate the playlist using the GPT model
    # reply = gpt.gpt_single_reply(final_prompt)
    # reply = gpt.query_perplexity(final_prompt)
    reply = gpt.personal_gpt(final_prompt)
    
    print(reply)
    # reply = gpt.query_perplexity(prompt)

    titles, artists = parse_answer_playlist(reply)
    
    print(titles)
    print(artists)
    
    titles = titles.split(';')
    artists = artists.split(';')
    
    urls = []
    for title, artist in zip(titles, artists):
        try:
            print(f'getting links for {title}...')
            url = spotify.get_song_url(artist, title)
        except Exception as e:
            print(f'----failed for {title}, {artist}', e)
            url = ''
        urls.append(url)
    playlist = [{"title": title, "artist": artist, "url": url} for title, artist, url in zip(titles, artists, urls)]
    
    print(playlist)

    # Store the playlist in Redis
    redis_client.set(f"playlist:{room_name}", json.dumps(playlist))

    print(f'Time taken: {time.time() -  start_time}')
    # print(urls)
    
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

    output_filename = Path(__file__).parent.parent / 'frontend' / 'react_dj' / 'public' / 'images' / f"qr_code_{room_name}.png"
    generate_qr_code_with_logo(f'http://aico-music.com/playroom?room_name={room_name}', output_filename)

    output_filename = Path(__file__).parent.parent / 'frontend' / 'react_dj' / 'build' / 'images' / f"qr_code_{room_name}.png"
    generate_qr_code_with_logo(f'http://aico-music.com/playroom?room_name={room_name}', output_filename)

    
    playlist_json = redis_client.get(f"playlist:{room_name}")

    if playlist_json:
        playlist = json.loads(playlist_json)
    else:
        # Return an empty playlist if not found
        playlist = []

    # playlist = [
    #     {"id": "spotify:track:1234", "title": "Song 1", "artist": "Artist 1"},
    #     {"id": "spotify:track:5678", "title": "Song 2", "artist": "Artist 2"},
    #     {"id": "spotify:track:9101", "title": "Song 3", "artist": "Artist 3"},
    # ]
    return jsonify({"playlist": playlist})

if __name__ == '__main__':
    # app.run(port=3000, host='10.72.252.213', debug=True)
    app.run(port=5000, host='0.0.0.0', debug=True)
    # http://13.56.253.58/