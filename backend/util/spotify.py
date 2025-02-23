import requests
import base64
import json

# Replace these with your own Spotify API credentials
CLIENT_ID = '1bf7160dc56446378b569f7a74064a12'
CLIENT_SECRET = 'b40741c5b40a442881e4845602c76322'

def memoize(f):
    cache = {}
    def _call_with_cache(*args, **kwargs):
        key = "{} - {}".format(args, kwargs)
        if key not in cache:
            cache[key] = f(*args, **kwargs)
        return cache[key]
    return _call_with_cache

# @memoize
def get_access_token(client_id, client_secret):
    auth_string = f"{client_id}:{client_secret}"
    auth_bytes = auth_string.encode('utf-8')
    auth_base64 = str(base64.b64encode(auth_bytes), 'utf-8')
    
    url = "https://accounts.spotify.com/api/token"
    headers = {
        "Authorization": f"Basic {auth_base64}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    data = {"grant_type": "client_credentials"}
    
    response = requests.post(url, headers=headers, data=data, verify=False)
    json_result = json.loads(response.content)
    return json_result['access_token']
    
# @memoize
def search_artist_tracks(artist_name='', track_name='', access_token=''):
    access_token = get_access_token(CLIENT_ID, CLIENT_SECRET)
    url = "https://api.spotify.com/v1/search"
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    if not track_name:
        query = f"artist:{artist_name}"
    elif not artist_name:
        query = f"track:{track_name}"
    else:
        query = f"artist:{artist_name}, track:{track_name}"
    params = {
        "q": query,
        "type": "track",
        "limit": 50  # Maximum allowed by the API
    }
    
    all_tracks = []
    
    # while True:
    response = requests.get(url, headers=headers, params=params, verify=False)
    
    json_result = json.loads(response.content)
    # print(json_result)
    
    if 'tracks' in json_result and 'items' in json_result['tracks']:
        tracks = json_result['tracks']['items']
        all_tracks.extend(tracks)
        
        # if json_result['tracks']['next']:
        #     params['offset'] = json_result['tracks']['offset'] + len(tracks)
    #     else:
    #         break
    # else:
    #     break
    
    return all_tracks, json_result


def search_spotify(query):
    access_token = get_access_token(CLIENT_ID, CLIENT_SECRET)
    # search by artist name
    all_tracks, json_result = search_artist_tracks(artist_name=query)

    # # search by track_name
    # all_tracks, json_result = search_artist_tracks(track_name=query)

    # # merge and dedup
    # # Merge the results from both searches
    # combined_tracks = {track['id']: track for track in all_tracks}.values()

    # # Deduplicate tracks by their Spotify ID
    # unique_tracks = list(combined_tracks)

    # return unique_tracks, json_result
    return all_tracks, json_result

@memoize
def get_song_url(artist_name, track_name):
    # artist_name = "Justin Timberlake"
    # track_name = "Can't Stop the Feeling!"
    access_token = get_access_token(CLIENT_ID, CLIENT_SECRET)
    tracks, json_result = search_artist_tracks(artist_name, track_name, access_token)
    # print('============ tracks ===============')
    # print(tracks)
    # print('============ result ===============')
    # print(json_result)
    
    url = json_result['tracks']['items'][0]['external_urls']['spotify']
    id = json_result['tracks']['items'][0]['id']
    return url, id

if __name__=='__main__':
    artist_name = "Eason Chen"
    # track_name = "Can't Stop the Feeling!"
    tracks, json_result = search_artist_tracks(artist_name)
    # print('============ tracks ===============')
    # print(tracks)
    # print('============ result ===============')
    # print(json_result)

    results = [{
        "title": track.get('name'),
        "artist": track['artists'][0]['name'] if track.get('artists') else "Unknown Artist",
        "url": track['external_urls']['spotify'] if track.get('external_urls') else "",
        "id": track.get('id'),
        "image_url": track['album']['images'][0]['url'] if track.get('album') and track['album'].get('images') else ""
    } for track in tracks]

    print(results)
    # {'tracks': {'href': 'https://api.spotify.com/v1/search?query=artist%3AJustin+Timberlake%2C+track%3A&type=track&offset=0&limit=50', 'items': [{'album': {'album_type': 'compilation', 'artists': [{'external_urls': {'spotify': 'https://open.spotify.com/artist/6tbjWDEIzxoDsBA1FuhfPW'}, 'href': 'https://api.spotify.com/v1/artists/6tbjWDEIzxoDsBA1FuhfPW', 'id': '6tbjWDEIzxoDsBA1FuhfPW', 'name': 'Madonna', 'type': 'artist', 'uri': 'spotify:artist:6tbjWDEIzxoDsBA1FuhfPW'}], 'available_markets': ['US'], 'external_urls': {'spotify': 'https://open.spotify.com/album/4GU7z3q6fg90MWrkTacYYG'}, 'href': 'https://api.spotify.com/v1/albums/4GU7z3q6fg90MWrkTacYYG', 'id': '4GU7z3q6fg90MWrkTacYYG', 'images': [{'height': 640, 'url': 'https://i.scdn.co/image/ab67616d0000b273a9c7219995206b7b7004ba2f', 'width': 640}, {'height': 300, 'url': 'https://i.scdn.co/image/ab67616d00001e02a9c7219995206b7b7004ba2f', 'width': 300}, {'height': 64, 'url': 'https://i.scdn.co/image/ab67616d00004851a9c7219995206b7b7004ba2f', 'width': 64}], 'name': 'Celebration (Bonus Track Version)', 'release_date': '2009-09-18', 'release_date_precision': 'day', 'total_tracks': 38, 'type': 'album', 'uri': 'spotify:album:4GU7z3q6fg90MWrkTacYYG'}, 'artists': [{'external_urls': {'spotify': 'https://open.spotify.com/artist/6tbjWDEIzxoDsBA1FuhfPW'}, 'href': 'https://api.spotify.com/v1/artists/6tbjWDEIzxoDsBA1FuhfPW', 'id': '6tbjWDEIzxoDsBA1FuhfPW', 'name': 'Madonna', 'type': 'artist', 'uri': 'spotify:artist:6tbjWDEIzxoDsBA1FuhfPW'}, {'external_urls': {'spotify': 'https://open.spotify.com/artist/31TPClRtHm23RisEBtV3X7'}, 'href': 'https://api.spotify.com/v1/artists/31TPClRtHm23RisEBtV3X7', 'id': '31TPClRtHm23RisEBtV3X7', 'name': 'Justin Timberlake', 'type': 'artist', 'uri': 'spotify:artist:31TPClRtHm23RisEBtV3X7'}, {'external_urls': {'spotify': 'https://open.spotify.com/artist/5Y5TRrQiqgUO4S36tzjIRZ'}, 'href': 'https://api.spotify.com/v1/artists/5Y5TRrQiqgUO4S36tzjIRZ', 'id': '5Y5TRrQiqgUO4S36tzjIRZ', 'name': 'Timbaland', 'type': 'artist', 'uri': 'spotify:artist:5Y5TRrQiqgUO4S36tzjIRZ'}], 'available_markets': ['US'], 'disc_number': 1, 'duration_ms': 189693, 'explicit': False, 'external_ids': {'isrc': 'USWB10903601'}, 'external_urls': {'spotify': 'https://open.spotify.com/track/0WLh2RYzULomRcUd35IhCk'}, 'href': 'https://api.spotify.com/v1/tracks/0WLh2RYzULomRcUd35IhCk', 'id': '0WLh2RYzULomRcUd35IhCk', 'is_local': False, 'name': '4 Minutes (feat. Justin Timberlake & Timbaland)', 'popularity': 23, 'preview_url': 'https://p.scdn.co/mp3-preview/57e975c1cc003797ed03390474ce9e345e20e031?cid=1bf7160dc56446378b569f7a74064a12', 'track_number': 4, 'type': 'track', 'uri': 'spotify:track:0WLh2RYzULomRcUd35IhCk'}, {'album': {'album_type': 'compilation', 'artists': [{'external_urls': {'spotify': 'https://open.spotify.com/artist/0LyfQWJT6nXafLPZqxe9Of'}, 'href': 'https://api.spotify.com/v1/artists/0LyfQWJT6nXafLPZqxe9Of', 'id': '0LyfQWJT6nXafLPZqxe9Of', 'name': 'Various Artists', 'type': 'artist', 'uri': 'spotify:artist:0LyfQWJT6nXafLPZqxe9Of'}], 'available_markets': ['US'], 'external_urls': {'spotify': 'https://open.spotify.com/album/70DTiFYxkFuou42yT6cSK2'}, 'href': 'https://api.spotify.com/v1/albums/70DTiFYxkFuou42yT6cSK2', 'id': '70DTiFYxkFuou42yT6cSK2', 'images': [{'height': 640, 'url': 'https://i.scdn.co/image/ab67616d0000b27310d9c5d1792ace84e8e20c5f', 'width': 640}, {'height': 300, 'url': 'https://i.scdn.co/image/ab67616d00001e0210d9c5d1792ace84e8e20c5f', 'width': 300}, {'height': 64, 'url': 'https://i.scdn.co/image/ab67616d0000485110d9c5d1792ace84e8e20c5f', 'width': 64}], 'name': "NOW That's What I Call Music 31 (20 track Dell Bundle)", 'release_date': '2009-01-01', 'release_date_precision': 'day', 'total_tracks': 20, 'type': 'album', 'uri': 'spotify:album:70DTiFYxkFuou42yT6cSK2'}, 'artists': [{'external_urls': {'spotify': 'https://open.spotify.com/artist/4OBJLual30L7gRl5UkeRcT'}, 'href': 'https://api.spotify.com/v1/artists/4OBJLual30L7gRl5UkeRcT', 'id': '4OBJLual30L7gRl5UkeRcT', 'name': 'T.I.', 'type': 'artist', 'uri': 'spotify:artist:4OBJLual30L7gRl5UkeRcT'}, {'external_urls': {'spotify': 'https://open.spotify.com/artist/31TPClRtHm23RisEBtV3X7'}, 'href': 'https://api.spotify.com/v1/artists/31TPClRtHm23RisEBtV3X7', 'id': '31TPClRtHm23RisEBtV3X7', 'name': 'Justin Timberlake', 'type': 'artist', 'uri': 'spotify:artist:31TPClRtHm23RisEBtV3X7'}], 'available_markets': ['US'], 'disc_number': 1, 'duration_ms': 232640, 'explicit': False, 'external_ids': {'isrc': 'USAT20804954'}, 'external_urls': {'spotify': 'https://open.spotify.com/track/5hNPiM4GgmmcLQr5r6w2UA'}, 'href': 'https://api.spotify.com/v1/tracks/5hNPiM4GgmmcLQr5r6w2UA', 'id': '5hNPiM4GgmmcLQr5r6w2UA', 'is_local': False, 'name': 'Dead And Gone - Promo', 'popularity': 4, 'preview_url': None, 'track_number': 6, 'type': 'track', 'uri': 'spotify:track:5hNPiM4GgmmcLQr5r6w2UA'}, {'album': {'album_type': 'compilation', 'artists': [{'external_urls': {'spotify': 'https://open.spotify.com/artist/0LyfQWJT6nXafLPZqxe9Of'}, 'href': 'https://api.spotify.com/v1/artists/0LyfQWJT6nXafLPZqxe9Of', 'id': '0LyfQWJT6nXafLPZqxe9Of', 'name': 'Various Artists', 'type': 'artist', 'uri': 'spotify:artist:0LyfQWJT6nXafLPZqxe9Of'}], 'available_markets': ['US'], 'external_urls': {'spotify': 'https://open.spotify.com/album/70DTiFYxkFuou42yT6cSK2'}, 'href': 'https://api.spotify.com/v1/albums/70DTiFYxkFuou42yT6cSK2', 'id': '70DTiFYxkFuou42yT6cSK2', 'images': [{'height': 640, 'url': 'https://i.scdn.co/image/ab67616d0000b27310d9c5d1792ace84e8e20c5f', 'width': 640}, {'height': 300, 'url': 'https://i.scdn.co/image/ab67616d00001e0210d9c5d1792ace84e8e20c5f', 'width': 300}, {'height': 64, 'url': 'https://i.scdn.co/image/ab67616d0000485110d9c5d1792ace84e8e20c5f', 'width': 64}], 'name': "NOW That's What I Call Music 31 (20 track Dell Bundle)", 'release_date': '2009-01-01', 'release_date_precision': 'day', 'total_tracks': 20, 'type': 'album', 'uri': 'spotify:album:70DTiFYxkFuou42yT6cSK2'}, 'artists': [{'external_urls': {'spotify': 'https://open.spotify.com/artist/2NdeV5rLm47xAvogXrYhJX'}, 'href': 'https://api.spotify.com/v1/artists/2NdeV5rLm47xAvogXrYhJX', 'id': '2NdeV5rLm47xAvogXrYhJX', 'name': 'Ciara', 'type': 'artist', 'uri': 'spotify:artist:2NdeV5rLm47xAvogXrYhJX'}, {'external_urls': {'spotify': 'https://open.spotify.com/artist/31TPClRtHm23RisEBtV3X7'}, 'href': 'https://api.spotify.com/v1/artists/31TPClRtHm23RisEBtV3X7', 'id': '31TPClRtHm23RisEBtV3X7', 'name': 'Justin Timberlake', 'type': 'artist', 'uri': 'spotify:artist:31TPClRtHm23RisEBtV3X7'}], 'available_markets': ['US'], 'disc_number': 1, 'duration_ms': 219173, 'explicit': False, 'external_ids': {'isrc': 'USLF20900012'}, 'external_urls': {'spotify': 'https://open.spotify.com/track/3J1AYe79Y6KoA3q4so0t52'}, 'href': 'https://api.spotify.com/v1/tracks/3J1AYe79Y6KoA3q4so0t52', 'id': '3J1AYe79Y6KoA3q4so0t52', 'is_local': False, 'name': 'Love Sex Magic', 'popularity': 1, 'preview_url': None, 'track_number': 12, 'type': 'track', 'uri': 'spotify:track:3J1AYe79Y6KoA3q4so0t52'}], 'limit': 50, 'next': None, 'offset': 0, 'previous': None, 'total': 3}}
    
    # url, id = get_song_url(artist_name, track_name)
    # print(url, id)