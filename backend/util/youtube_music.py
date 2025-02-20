from ytmusicapi import YTMusic

# Initialize YTMusic API
ytmusic = YTMusic()

def get_song_info(song_name, artist_name=None):
    """
    Search for a song on YouTube Music and return its playable URL and cover image URL.
    Optionally, input an artist name to improve search accuracy.

    :param song_name: str, name of the song to search
    :param artist_name: str, (optional) name of the artist to refine search
    :return: dict with 'song_url', 'cover_img_url', 'song_id', or an error message if no song is found
    """

    # Combine artist name with song name if provided
    query = f"{song_name} {artist_name}" if artist_name else song_name

    # Search for the song
    results = ytmusic.search(query, filter="songs")
    if not results:
        return {"error": "No songs found."}

    # Extract the best-matching result
    best_match = results[0]  # Default to the first result if no artist is specified
    for song in results:
        if artist_name:
            # If artist_name is provided, try to match it
            song_artists = [artist["name"].lower() for artist in song.get("artists", [])]
            if artist_name.lower() in song_artists:
                best_match = song
                break
            

    # Extract details
    # print(f'best_match:{best_match}')
    song_id = best_match.get("videoId")
    thumbnail_url = best_match.get("thumbnails", [{}])[-1].get("url", "")
    title = best_match.get("title")
    album = best_match.get("album", {}).get("name")
    artist = ", ".join([a["name"] for a in best_match.get("artists", [])])
    duration_seconds = best_match.get("duration_seconds", 0)

    if not song_id:
        return {"error": "Song ID not found."}

    # Generate playable YouTube Music URL
    song_url = f"https://music.youtube.com/watch?v={song_id}"

    return {
        "song_id": song_id,
        "song_url": song_url,
        "cover_img_url": thumbnail_url,
        "title": title,
        "artist": artist,
        "album": album,
        "duration_seconds": duration_seconds,
    }


from ytmusicapi import YTMusic

def search_artist_tracks(artist_name, max_results=10):
    """
    Search for an artist's tracks on YouTube Music and return a list of song details.

    :param artist_name: str, name of the artist to search
    :param max_results: int, number of songs to return (default: 10)
    :return: list of dicts containing song info (song_id, song_url, cover_img_url, title, artist, album)
    """
    ytmusic = YTMusic()

    # Search for the artist
    search_results = ytmusic.search(artist_name, filter="artists")
    if not search_results:
        return {"error": "No artists found."}

    # Get artist's ID
    artist_id = search_results[0].get("browseId")
    if not artist_id:
        return {"error": "Artist ID not found."}

    # Get artist details to extract songs_browse_id
    artist_data = ytmusic.get_artist(artist_id)
    songs_browse_id = artist_data.get("songs", {}).get("browseId")
    # print(f'songs_browse_id:{songs_browse_id}')

    if not songs_browse_id:
        return {"error": "No songs found for this artist."}

    # Fetch songs using browseId (to get more than 5 results)
    song_list = []
    next_page_token = None

    # Fetch song list
    song_data = ytmusic.get_playlist(songs_browse_id, limit=100)

    for song in song_data.get("tracks", []):
        song_info = {
            "song_id": song.get("videoId"),
            "song_url": f"https://music.youtube.com/watch?v={song.get('videoId')}" if song.get("videoId") else None,
            "cover_img_url": song.get("thumbnails", [{}])[-1].get("url", ""),
            "title": song.get("title"),
            "artist": ", ".join([a["name"] for a in song.get("artists", [])]),
            "album": song.get("album", {}).get("name"),
            "duration_seconds": song.get("duration_seconds", 0),
        }
        song_list.append(song_info)

    return song_list[:max_results]  # Limit results



def search_song_tracks(song_name, max_results=10):
    """
    Search for tracks related to a song name on YouTube Music and return a list of song details.

    :param song_name: str, name of the song to search
    :param max_results: int, number of songs to return (default: 10)
    :return: list of dicts containing song info (song_id, song_url, cover_img_url, title, artist, album, duration_seconds)
    """
    ytmusic = YTMusic()

    # Search for the song
    search_results = ytmusic.search(song_name, filter="songs")
    if not search_results:
        return {"error": "No songs found."}

    # Extract song details
    song_list = []
    for song in search_results[:max_results]:  # Limit the number of results
        song_id = song.get("videoId")

        # Get full song details for high-resolution cover and duration
        full_song_data = ytmusic.get_song(song_id) if song_id else {}

        # Extract highest resolution cover image
        thumbnails = full_song_data.get("videoDetails", {}).get("thumbnail", {}).get("thumbnails", [])
        full_cover_url = thumbnails[-1]["url"] if thumbnails else song.get("thumbnails", [{}])[-1].get("url", "")

        song_info = {
            "song_id": song_id,
            "song_url": f"https://music.youtube.com/watch?v={song_id}" if song_id else None,
            "cover_img_url": full_cover_url,
            "title": song.get("title"),
            "artist": ", ".join([a["name"] for a in song.get("artists", [])]),
            "album": song.get("album", {}).get("name"),
            "duration_seconds": full_song_data.get("videoDetails", {}).get("lengthSeconds", 0),
        }
        song_list.append(song_info)

    return song_list[:max_results]  # Limit results


if __name__=='__main__':
    # artist_name = "Eason Chen"
    # # artist_name = "Taylor Swift"
    # artist_tracks = search_artist_tracks(artist_name, max_results=20)
    # for track in artist_tracks:
    #     print(track)

    print(get_song_info("紧急联络人"))  # Get URL and cover image
    # Example Usage:
    # print(get_song_info("Shape of You", "Ed Sheeran"))  # With artist for better accuracy
    # print(get_song_info("Blueberry Night", "Kenshi Yonezu"))
    # print(get_song_info("Shape of You"))  # Without artist
