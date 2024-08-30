from flask import Flask, request, jsonify
import gpt
import spotify

app = Flask(__name__)


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
    data = request.json
    prompt = data.get('prompt')
    genre = data.get('genre')
    occasion = data.get('occasion')

    print(prompt)
    print(genre)
    print(occasion)

    final_prompt = f"""I'll give you a music requirement, genre, and an occasion, and you'll generate a playlist of music for me. Make sure the playlist is suitable for the given genre and occasion.
    The output format of the playlist should be two list: titles and artists. such that the title is the full name of the song, and artist is the full name of the corresponding musician. Each one separated by a semicolon ;, and the sequence and length should be matched.

    Output Example:
    titles: music1;music2;music3;
    artists: artist1;artist2;artist3;

    The given input is as followed:
    music requirement: {prompt}
    Genre: {genre}
    Occasion: {occasion}
    """

    # Generate the playlist using the GPT model
    reply = gpt.gpt_single_reply(final_prompt)
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
    # print(urls)
    
    # Here you would implement your playlist generation logic
    # For now, we'll return a dummy playlist
    # playlist = [
    #     {"title": "Song 1", "artist": "Artist 1"},
    #     {"title": "Song 2", "artist": "Artist 2"},
    #     {"title": "Song 3", "artist": "Artist 3"},
    # ]
    
    return jsonify({"playlist": playlist})

if __name__ == '__main__':
    # app.run(port=3000, host='10.72.252.213', debug=True)
    app.run(port=3000, debug=True)