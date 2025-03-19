# Add to a new file: util/lyrics.py

import requests
from bs4 import BeautifulSoup
import re
import logging
import urllib.parse
import json
import time
import redis
import hashlib
import random
from urllib3.exceptions import InsecureRequestWarning
import urllib3

# Suppress only the single InsecureRequestWarning
urllib3.disable_warnings(InsecureRequestWarning)

# Configure logger
logger = logging.getLogger(__name__)

# Connect to Redis for caching
redis_client = redis.Redis(host='localhost', port=6379, db=0)
# Set cache expiration time (12 weeks)
CACHE_EXPIRATION = 60 * 60 * 24 * 7 * 12

# List of user agents to rotate
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:98.0) Gecko/20100101 Firefox/98.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/91.0.4472.80 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/91.0.4472.80 Mobile/15E148 Safari/604.1'
]

def get_random_user_agent():
    """Return a random user agent from the list"""
    return random.choice(USER_AGENTS)

redis_verion = '_v1'
def create_cache_key(title, artist):
    """Create a standardized cache key for lyrics"""
    key_string = f"{title.lower().strip()}:{artist.lower().strip()}{redis_verion}"
    # return f"lyrics:{hashlib.md5(key_string.encode()).hexdigest()}"
    return f"lyrics:{key_string}"

def is_chinese(text):
    """Check if text contains Chinese characters"""
    if not text:
        return False
    # Unicode ranges for common Chinese characters
    chinese_ranges = [
        (0x4E00, 0x9FFF),    # CJK Unified Ideographs
        (0x3400, 0x4DBF),    # CJK Unified Ideographs Extension A
        (0x20000, 0x2A6DF),  # CJK Unified Ideographs Extension B
        (0x2A700, 0x2B73F),  # CJK Unified Ideographs Extension C
        (0x2B740, 0x2B81F),  # CJK Unified Ideographs Extension D
        (0x2B820, 0x2CEAF),  # CJK Unified Ideographs Extension E
        (0xF900, 0xFAFF),    # CJK Compatibility Ideographs
    ]
    
    for char in text:
        char_code = ord(char)
        for start, end in chinese_ranges:
            if start <= char_code <= end:
                return True
    return False

# Update the fetch_lyrics function in util/lyrics.py to preserve timestamps

def fetch_lyrics(song_title, artist_name, include_timestamps=True):
    """
    Fetch lyrics for a song from various sources with caching
    
    Parameters:
    song_title (str): Title of the song
    artist_name (str): Name of the artist
    include_timestamps (bool): If True, returns timestamps with lyrics for synchronized display
    
    Returns:
    dict: Containing raw_lyrics (with timestamps) and formatted_lyrics (without timestamps)
         or just a string with formatted lyrics if include_timestamps is False
    """
    # Check cache first
    cache_key = create_cache_key(song_title, artist_name)
    cached_lyrics = redis_client.get(cache_key)
    
    if cached_lyrics:
        logger.info(f"Lyrics cache hit for {song_title} by {artist_name}")
        cached_data = json.loads(cached_lyrics.decode('utf-8'))
        if include_timestamps:
            return cached_data
        else:
            return cached_data.get('formatted_lyrics', f"Lyrics for '{song_title}' by {artist_name} not found.")
    
    # Result structure
    result = {
        'raw_lyrics': '',            # Original lyrics with timestamps
        'formatted_lyrics': '',      # Clean lyrics without timestamps
        'timed_lyrics': [],          # Array of {time: milliseconds, text: "lyric line"}
        'source': 'none'             # The source that provided these lyrics
    }
    
    # Check if the song or artist name contains Chinese characters
    # is_chinese_song = is_chinese(song_title) or is_chinese(artist_name)
    is_chinese_song = True
    
    # Try source selection based on language
    if is_chinese_song:
        # Try Chinese sources first for Chinese songs
        logger.info(f"Detected Chinese song: {song_title} by {artist_name}")
        # Try NetEase first for Chinese songs (most comprehensive)
        netease_result = try_netease_lyrics(song_title, artist_name)
        if netease_result:
            result = netease_result
            result['source'] = 'netease'
        
        if not result['formatted_lyrics']:
            # Try QQ Music second
            qq_result = try_qq_music_lyrics(song_title, artist_name)
            if qq_result:
                result = qq_result
                result['source'] = 'qqmusic'
                
        if not result['formatted_lyrics']:
            # Try Kugou third
            kugou_result = try_kugou_lyrics(song_title, artist_name)
            if kugou_result:
                result = kugou_result
                result['source'] = 'kugou'
    else:
        # For non-Chinese songs, try the original sources
        genius_result = try_genius_lyrics(song_title, artist_name)
        if genius_result:
            result = genius_result
            result['source'] = 'genius'
        
        if not result['formatted_lyrics']:
            musixmatch_result = try_musixmatch_lyrics(song_title, artist_name)
            if musixmatch_result:
                result = musixmatch_result
                result['source'] = 'musixmatch'
    
    # If Chinese-specific sources failed but song is Chinese, try general sources
    if not result['formatted_lyrics'] and is_chinese_song:
        genius_result = try_genius_lyrics(song_title, artist_name)
        if genius_result:
            result = genius_result
            result['source'] = 'genius'
            
        if not result['formatted_lyrics']:
            musixmatch_result = try_musixmatch_lyrics(song_title, artist_name)
            if musixmatch_result:
                result = musixmatch_result
                result['source'] = 'musixmatch'
    
    # If non-Chinese sources failed but song might be Chinese, try Chinese sources
    if not result['formatted_lyrics'] and not is_chinese_song:
        netease_result = try_netease_lyrics(song_title, artist_name)
        if netease_result:
            result = netease_result
            result['source'] = 'netease'
            
        if not result['formatted_lyrics']:
            qq_result = try_qq_music_lyrics(song_title, artist_name)
            if qq_result:
                result = qq_result
                result['source'] = 'qqmusic'
    
    if not result['formatted_lyrics']:
        result['formatted_lyrics'] = f"Lyrics for '{song_title}' by {artist_name} not found."
    
    else:
        # Cache the results
        redis_client.setex(cache_key, CACHE_EXPIRATION, json.dumps(result))
    
    if include_timestamps:
        return result
    else:
        return result['formatted_lyrics']

def try_netease_lyrics(song_title, artist_name):
    """
    Try to fetch lyrics from NetEase Music (网易云音乐) API - very good for Chinese songs
    Returns lyrics with timestamps for synced display
    """
    result = {
        'raw_lyrics': '',
        'formatted_lyrics': '',
        'timed_lyrics': []
    }
    
    try:
        # First search for the song ID
        headers = {
            'User-Agent': get_random_user_agent(),
            'Referer': 'https://music.163.com/',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        search_url = 'https://music.163.com/api/search/get/'
        search_params = {
            's': f"{song_title} {artist_name}",
            'type': 1,  # 1 for songs
            'offset': 0,
            'limit': 5
        }
        
        search_response = requests.get(search_url, params=search_params, headers=headers, timeout=10)
        if search_response.status_code != 200:
            return None
        
        search_data = search_response.json()
        songs = search_data.get('result', {}).get('songs', [])
        
        if not songs:
            return None
        
        # Find the best matching song
        best_match = None
        for song in songs:
            artist_match = False
            song_artists = [artist.get('name', '').lower() for artist in song.get('artists', [])]
            if artist_name.lower() in song_artists or any(artist_name.lower() in artist.lower() for artist in song_artists):
                artist_match = True
            
            song_name = song.get('name', '').lower()
            if (song_title.lower() in song_name or song_name in song_title.lower()) and artist_match:
                best_match = song
                break
        
        if not best_match:
            best_match = songs[0]  # Default to first result if no good match
        
        song_id = best_match.get('id')
        if not song_id:
            return None
        
        # Now get the lyrics using the song ID
        lyric_url = f'https://music.163.com/api/song/lyric?id={song_id}&lv=1&kv=1&tv=-1'
        lyric_response = requests.get(lyric_url, headers=headers, timeout=10)
        
        if lyric_response.status_code != 200:
            return None
        
        lyric_data = lyric_response.json()
        raw_lyric = lyric_data.get('lrc', {}).get('lyric', '')
        
        if not raw_lyric:
            return None
        
        # Store raw lyrics with timestamps
        result['raw_lyrics'] = raw_lyric
        
        # Parse the timestamped lyrics
        timed_lyrics = []
        timestamp_pattern = r'\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)'
        
        for line in raw_lyric.split('\n'):
            match = re.match(timestamp_pattern, line)
            if match:
                minutes = int(match.group(1))
                seconds = int(match.group(2))
                milliseconds = int(match.group(3).ljust(3, '0')[:3])  # Ensure 3 digits
                
                # Convert to milliseconds
                time_ms = (minutes * 60 * 1000) + (seconds * 1000) + milliseconds
                text = match.group(4).strip()
                
                if text:  # Only add non-empty lines
                    timed_lyrics.append({
                        'time': time_ms,
                        'text': text
                    })
        
        # Sort by time
        timed_lyrics.sort(key=lambda x: x['time'])
        result['timed_lyrics'] = timed_lyrics
        
        # Clean up the lyrics for display (without timestamps)
        cleaned_lyrics = re.sub(r'\[\d{2}:\d{2}\.\d{2,3}\]', '', raw_lyric)
        cleaned_lyrics = re.sub(r'\n{3,}', '\n\n', cleaned_lyrics)
        result['formatted_lyrics'] = cleaned_lyrics.strip()
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching lyrics from NetEase: {str(e)}")
        return None

# Update the QQ Music function in lyrics.py to return timestamps

def try_qq_music_lyrics(song_title, artist_name):
    """
    Try to fetch lyrics from QQ Music (QQ音乐) - another good source for Chinese songs
    """
    result = {
        'raw_lyrics': '',
        'formatted_lyrics': '',
        'timed_lyrics': []
    }
    
    try:
        headers = {
            'User-Agent': get_random_user_agent(),
            'Referer': 'https://y.qq.com/'
        }
        
        # First search for the song
        search_url = 'https://c.y.qq.com/soso/fcgi-bin/client_search_cp'
        search_params = {
            'w': f"{song_title} {artist_name}",
            'format': 'json',
            'inCharset': 'utf-8',
            'outCharset': 'utf-8',
            'platform': 'yqq',
            'p': 1,
            'n': 5
        }
        
        search_response = requests.get(search_url, params=search_params, headers=headers, timeout=10)
        if search_response.status_code != 200:
            return None
        
        search_data = search_response.json()
        songs = search_data.get('data', {}).get('song', {}).get('list', [])
        
        if not songs:
            return None
        
        # Find the best matching song
        best_match = None
        for song in songs:
            song_name = song.get('songname', '').lower()
            singer_name = song.get('singer', [{}])[0].get('name', '').lower() if song.get('singer') else ''
            
            if (song_title.lower() in song_name or song_name in song_title.lower()) and \
               (artist_name.lower() in singer_name or singer_name in artist_name.lower()):
                best_match = song
                break
        
        if not best_match:
            best_match = songs[0]  # Default to first result if no good match
        
        song_mid = best_match.get('songmid')
        if not song_mid:
            return None
        
        # Now get the lyrics using the song mid
        lyric_url = f'https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg'
        lyric_params = {
            'songmid': song_mid,
            'format': 'json',
            'inCharset': 'utf-8',
            'outCharset': 'utf-8',
            'nobase64': 1,
            'g_tk': '5381',
            'loginUin': '0',
            'hostUin': '0'
        }
        
        lyric_headers = headers.copy()
        lyric_headers['Referer'] = 'https://y.qq.com/portal/player.html'
        
        lyric_response = requests.get(lyric_url, params=lyric_params, headers=lyric_headers, timeout=10)
        
        if lyric_response.status_code != 200:
            return None
        
        lyric_data = lyric_response.json()
        raw_lyric = lyric_data.get('lyric', '')
        
        if not raw_lyric:
            return None
        
        # QQ Music lyrics may need to be decoded
        if '&#' in raw_lyric:
            raw_lyric = raw_lyric.replace('&#58;', ':').replace('&#10;', '\n').replace('&#46;', '.')
            raw_lyric = re.sub(r'&#\d+;', '', raw_lyric)
        
        # Store raw lyrics
        result['raw_lyrics'] = raw_lyric
        
        # Parse timestamps - QQ Music uses same format as NetEase
        timed_lyrics = []
        timestamp_pattern = r'\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)'
        
        for line in raw_lyric.split('\n'):
            match = re.match(timestamp_pattern, line)
            if match:
                minutes = int(match.group(1))
                seconds = int(match.group(2))
                milliseconds = int(match.group(3).ljust(3, '0')[:3])  # Ensure 3 digits
                
                # Convert to milliseconds
                time_ms = (minutes * 60 * 1000) + (seconds * 1000) + milliseconds
                text = match.group(4).strip()
                
                if text:  # Only add non-empty lines
                    timed_lyrics.append({
                        'time': time_ms,
                        'text': text
                    })
        
        # Sort by time
        timed_lyrics.sort(key=lambda x: x['time'])
        result['timed_lyrics'] = timed_lyrics
        
        # Clean up the lyrics - remove timestamps
        cleaned_lyrics = re.sub(r'\[\d{2}:\d{2}\.\d{2,3}\]', '', raw_lyric)
        cleaned_lyrics = re.sub(r'\n{3,}', '\n\n', cleaned_lyrics)
        result['formatted_lyrics'] = cleaned_lyrics.strip()
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching lyrics from QQ Music: {str(e)}")
        return None


# Update the Kugou Music function in lyrics.py to return timestamps

def try_kugou_lyrics(song_title, artist_name):
    """
    Try to fetch lyrics from Kugou Music (酷狗音乐)
    """
    result = {
        'raw_lyrics': '',
        'formatted_lyrics': '',
        'timed_lyrics': []
    }
    
    try:
        headers = {
            'User-Agent': get_random_user_agent(),
            'Referer': 'https://www.kugou.com/'
        }
        
        # First search for the song
        search_url = 'http://mobilecdn.kugou.com/api/v3/search/song'
        search_params = {
            'keyword': f"{song_title} {artist_name}",
            'format': 'json',
            'page': 1,
            'pagesize': 5
        }
        
        search_response = requests.get(search_url, params=search_params, headers=headers, timeout=10)
        if search_response.status_code != 200:
            return None
        
        search_data = search_response.json()
        songs = search_data.get('data', {}).get('info', [])
        
        if not songs:
            return None
        
        # Find the best matching song
        best_match = None
        for song in songs:
            song_name = song.get('songname', '').lower()
            singer_name = song.get('singername', '').lower()
            
            if (song_title.lower() in song_name or song_name in song_title.lower()) and \
               (artist_name.lower() in singer_name or singer_name in artist_name.lower()):
                best_match = song
                break
        
        if not best_match:
            best_match = songs[0]  # Default to first result if no good match
        
        hash_code = best_match.get('hash')
        if not hash_code:
            return None
        
        # Get song info with hash
        song_url = 'http://m.kugou.com/app/i/getSongInfo.php'
        song_params = {
            'cmd': 'playInfo',
            'hash': hash_code
        }
        
        song_response = requests.get(song_url, params=song_params, headers=headers, timeout=10)
        if song_response.status_code != 200:
            return None
        
        song_data = song_response.json()
        
        # Extract lyrics URL
        lyrics_url = song_data.get('lyrics')
        if not lyrics_url:
            return None
        
        # Fetch lyrics content
        lyrics_response = requests.get(lyrics_url, headers=headers, timeout=10)
        if lyrics_response.status_code != 200:
            return None
        
        raw_lyrics = lyrics_response.text
        result['raw_lyrics'] = raw_lyrics
        
        # Parse timestamps - Kugou uses same [MM:SS.xx] format
        timed_lyrics = []
        timestamp_pattern = r'\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)'
        
        for line in raw_lyrics.split('\n'):
            match = re.match(timestamp_pattern, line)
            if match:
                minutes = int(match.group(1))
                seconds = int(match.group(2))
                milliseconds = int(match.group(3).ljust(3, '0')[:3])  # Ensure 3 digits
                
                # Convert to milliseconds
                time_ms = (minutes * 60 * 1000) + (seconds * 1000) + milliseconds
                text = match.group(4).strip()
                
                if text:  # Only add non-empty lines
                    timed_lyrics.append({
                        'time': time_ms,
                        'text': text
                    })
        
        # Sort by time
        timed_lyrics.sort(key=lambda x: x['time'])
        result['timed_lyrics'] = timed_lyrics
        
        # Clean up the lyrics - remove timestamps
        cleaned_lyrics = re.sub(r'\[\d{2}:\d{2}\.\d{2,3}\]', '', raw_lyrics)
        cleaned_lyrics = re.sub(r'\n{3,}', '\n\n', cleaned_lyrics)
        result['formatted_lyrics'] = cleaned_lyrics.strip()
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching lyrics from Kugou: {str(e)}")
        return None


# Update the Genius and Musixmatch functions in lyrics.py to use the same result structure

def try_genius_lyrics(song_title, artist_name):
    """
    Try to fetch lyrics from Genius
    Note: Genius doesn't provide timestamps, but we'll use the same result structure
    """
    result = {
        'raw_lyrics': '',
        'formatted_lyrics': '',
        'timed_lyrics': []
    }
    
    try:
        # Format the search query
        search_term = f"{song_title} {artist_name}"
        search_url = f"https://genius.com/api/search/multi?q={urllib.parse.quote(search_term)}"
        
        headers = {
            'User-Agent': get_random_user_agent()
        }
        
        # Get search results
        response = requests.get(search_url, headers=headers, timeout=10)
        if response.status_code != 200:
            return None
            
        data = response.json()
        
        # Look for song results
        song_hits = data.get('response', {}).get('sections', [])
        for section in song_hits:
            if section.get('type') == 'song':
                hits = section.get('hits', [])
                if hits:
                    # Get the first match's URL
                    song_url = hits[0].get('result', {}).get('url')
                    if song_url:
                        # Visit the song page to scrape lyrics
                        song_page = requests.get(song_url, headers=headers, timeout=10)
                        if song_page.status_code == 200:
                            soup = BeautifulSoup(song_page.text, 'html.parser')
                            lyrics_div = soup.find('div', class_=lambda c: c and 'Lyrics__Container' in c)
                            
                            if lyrics_div:
                                # Extract lyrics text
                                lyrics = ''
                                for elem in lyrics_div.find_all(['p', 'br']):
                                    if elem.name == 'br':
                                        lyrics += '\n'
                                    else:
                                        lyrics += elem.get_text()
                                
                                # Clean up the lyrics
                                lyrics = lyrics.replace('<br/>', '\n')
                                lyrics = re.sub(r'\[.*?\]', '', lyrics)  # Remove [Verse], [Chorus] etc.
                                lyrics = re.sub(r'\n{3,}', '\n\n', lyrics)  # Normalize spacing
                                
                                result['raw_lyrics'] = lyrics.strip()
                                result['formatted_lyrics'] = lyrics.strip()
                                
                                # Create artificial timestamps for display
                                # Since Genius doesn't provide real timestamps, create evenly spaced ones
                                lines = [line for line in lyrics.strip().split('\n') if line.strip()]
                                line_count = len(lines)
                                
                                if line_count > 0:
                                    # Assume an average song duration of 4 minutes
                                    estimated_duration_ms = 240000  # 4 minutes in milliseconds
                                    time_per_line = estimated_duration_ms / line_count
                                    
                                    for i, line in enumerate(lines):
                                        time_ms = int(i * time_per_line)
                                        if line.strip():  # Skip empty lines
                                            result['timed_lyrics'].append({
                                                'time': time_ms,
                                                'text': line.strip()
                                            })
                                
                                return result
        
        return None
    
    except Exception as e:
        logger.error(f"Error fetching lyrics from Genius: {str(e)}")
        return None

def try_musixmatch_lyrics(song_title, artist_name):
    """
    Try to fetch lyrics from Musixmatch
    Musixmatch has timestamps data but it's not easily accessible via scraping
    """
    result = {
        'raw_lyrics': '',
        'formatted_lyrics': '',
        'timed_lyrics': []
    }
    
    try:
        # Format the search query
        search_term = f"{song_title} {artist_name}"
        search_url = f"https://www.musixmatch.com/search/{urllib.parse.quote(search_term)}"
        
        headers = {
            'User-Agent': get_random_user_agent()
        }
        
        # Get search results
        response = requests.get(search_url, headers=headers, timeout=10)
        if response.status_code != 200:
            return None
            
        soup = BeautifulSoup(response.text, 'html.parser')
        track_links = soup.select('a.title')
        
        if track_links:
            track_url = f"https://www.musixmatch.com{track_links[0]['href']}"
            
            # Visit the track page
            track_page = requests.get(track_url, headers=headers, timeout=10)
            if track_page.status_code == 200:
                track_soup = BeautifulSoup(track_page.text, 'html.parser')
                lyrics_divs = track_soup.select('div.mxm-lyrics__content')
                
                if lyrics_divs:
                    lyrics = '\n'.join([div.get_text() for div in lyrics_divs])
                    
                    result['raw_lyrics'] = lyrics.strip()
                    result['formatted_lyrics'] = lyrics.strip()
                    
                    # Create artificial timestamps for display
                    # Since we can't easily get real timestamps from Musixmatch
                    lines = [line for line in lyrics.strip().split('\n') if line.strip()]
                    line_count = len(lines)
                    
                    if line_count > 0:
                        # Assume an average song duration of 4 minutes
                        estimated_duration_ms = 240000  # 4 minutes in milliseconds
                        time_per_line = estimated_duration_ms / line_count
                        
                        for i, line in enumerate(lines):
                            time_ms = int(i * time_per_line)
                            if line.strip():  # Skip empty lines
                                result['timed_lyrics'].append({
                                    'time': time_ms,
                                    'text': line.strip()
                                })
                    
                    return result
        
        return None
        
    except Exception as e:
        logger.error(f"Error fetching lyrics from Musixmatch: {str(e)}")
        return None


if __name__ == "__main__":
    # res = fetch_lyrics('富士山下', '陳奕迅')
    res = fetch_lyrics('Blank Space', "Taylor Swift")
    print(res)