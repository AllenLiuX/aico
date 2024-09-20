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

@memoize
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
def search_artist_tracks(artist_name, track_name, access_token):
    url = "https://api.spotify.com/v1/search"
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    params = {
        "q": f"artist:{artist_name}, track:{track_name}",
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
    artist_name = "Justin Timberlake"
    track_name = "Can't Stop the Feeling!"
    url, id = get_song_url(artist_name, track_name)
    print(url, id)