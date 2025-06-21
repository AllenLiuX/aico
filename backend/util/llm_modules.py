import util.gpt as gpt
import json
import logging

logger = logging.getLogger(__name__)


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


def llm_generate_playlist(prompt, genre, occasion, song_num=20, niche_level=50):
    # Handle 5 discrete niche level values (0, 25, 50, 75, 100)
    if niche_level == 0:
        popularity_instruction = "Focus exclusively on very popular, well-known, and mainstream songs that most people would recognize. Only include top chart hits and classics."
    elif niche_level == 25:
        popularity_instruction = "Include mostly familiar songs with some less-known tracks mixed in. Favor recognizable artists and songs, but allow for a few deeper cuts."
    elif niche_level == 50:
        popularity_instruction = "Create a balanced mix of popular and niche music. Include an equal amount of recognizable tracks and lesser-known gems."
    elif niche_level == 75:
        popularity_instruction = "Focus primarily on less mainstream music. Include mostly deep cuts, B-sides, and songs from rising artists, with only a few well-known tracks."
    else:  # niche_level == 100
        popularity_instruction = "Focus exclusively on niche, obscure, and unique songs that aren't widely known. Prioritize underground artists, deep cuts, and hidden gems. Avoid mainstream hits entirely."
    
    final_prompt = f"""
    I'll give you a music requirement possibly with genre and an occasion, and you'll generate a playlist of EXACTLY {song_num} songs for me. Make sure the playlist is suitable for the given genre and occasion.
    The output format of the playlist should be two list seperated by ;. The two list titles and artists are stored in two lines in the below format. such that the title is and only is the full name of the song, and artist is and only is the full name of the corresponding musician. 
    Do not provide any extra information. Each one separated by a semicolon ;, and the sequence and item number should be matched.
    Provide a paragraph of introduction about why you choose these songs and artists, what are their styles and backgrounds.
    Make sure you strictly follow the music requirement, instead of recommend very general songs.
    
    IMPORTANT INSTRUCTION ABOUT SONG SELECTION: {popularity_instruction}
    IMPORTANT: Please provide EXACTLY {song_num} songs, no more and no less.

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
    # logger.info('--- sending gpt request')
    reply = gpt.personal_gpt(final_prompt)        
    # logger.info(reply)

    titles, artists, introduction = parse_answer_playlist(reply)

    # logger.info(str(titles))   
    # logger.info(str(artists))
    # logger.info(str(introduction))
    
    titles = titles.split(';')
    artists = artists.split(';')

    return titles, artists, introduction, reply


def llm_moderate_song(song_title, song_artist, moderation_description, strictness_level='medium'):
    """
    Use LLM to determine if a song should be approved based on the host's moderation requirements.
    
    Args:
        song_title (str): Title of the song to be moderated
        song_artist (str): Artist of the song to be moderated
        moderation_description (str): Host's description of what songs are allowed
        strictness_level (str): 'strict', 'medium', or 'easy' - determines approval threshold
        
    Returns:
        dict: Contains approval status, score, and reasoning
    """
    # Set threshold based on strictness level
    thresholds = {
        'strict': 85,
        'medium': 70,
        'easy': 50
    }
    threshold = thresholds.get(strictness_level.lower(), 70)  # Default to medium if invalid
    
    prompt = f"""
    You are a music moderation AI that helps determine if songs match a host's preferences for a playlist.
    
    SONG INFORMATION:
    Title: {song_title}
    Artist: {song_artist}
    
    HOST'S MODERATION REQUIREMENTS:
    {moderation_description}
    
    Your task is to evaluate if this song should be approved for the playlist based on the host's requirements.
    Consider factors like genre, mood, lyrics content, artist style, and cultural relevance.
    
    Please provide your evaluation in the following JSON format:
    {{"score": <number between 0-100>, "approved": <true/false>, "reasoning": "<brief explanation>", "song_attributes": {{"genre": "<genre>", "mood": "<mood>", "energy": "<energy level>"}}}}
    
    The score should represent how well the song matches the host's requirements (0 = not at all, 100 = perfect match).
    A song is approved if its score is {threshold} or higher for the current strictness level ({strictness_level}).
    """
    
    try:
        response = gpt.personal_gpt(prompt)
        logger.info(f"LLM moderation response for {song_title} by {song_artist}: {response}")
        
        # Extract the JSON part from the response
        try:
            # Try to parse the entire response as JSON first
            result = json.loads(response)
        except json.JSONDecodeError:
            # If that fails, try to extract JSON from the text
            import re
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                try:
                    result = json.loads(json_match.group(0))
                except json.JSONDecodeError:
                    # If JSON extraction fails, create a default response
                    logger.error(f"Failed to parse JSON from LLM response: {response}")
                    result = {
                        "score": 0,
                        "approved": False,
                        "reasoning": "Error processing moderation request",
                        "song_attributes": {"genre": "unknown", "mood": "unknown", "energy": "unknown"}
                    }
            else:
                # No JSON-like structure found
                logger.error(f"No JSON found in LLM response: {response}")
                result = {
                    "score": 0,
                    "approved": False,
                    "reasoning": "Error processing moderation request",
                    "song_attributes": {"genre": "unknown", "mood": "unknown", "energy": "unknown"}
                }
        
        # Ensure the result has all required fields
        if "score" not in result:
            result["score"] = 0
        if "approved" not in result:
            result["approved"] = result["score"] >= threshold
        if "reasoning" not in result:
            result["reasoning"] = "No reasoning provided"
        if "song_attributes" not in result:
            result["song_attributes"] = {"genre": "unknown", "mood": "unknown", "energy": "unknown"}
            
        # Override the approved field based on the threshold
        result["approved"] = result["score"] >= threshold
        result["threshold"] = threshold
        result["strictness_level"] = strictness_level
        
        return result
        
    except Exception as e:
        logger.error(f"Error in llm_moderate_song: {str(e)}")
        return {
            "score": 0,
            "approved": False,
            "reasoning": f"Error: {str(e)}",
            "song_attributes": {"genre": "unknown", "mood": "unknown", "energy": "unknown"},
            "threshold": threshold,
            "strictness_level": strictness_level
        }


def llm_generate_moderation_hints(room_name, playlist_data=None, host_description=None):
    """
    Generate moderation hints based on room name, existing playlist, and host description.
    
    Args:
        room_name (str): Name of the playroom
        playlist_data (list): Current playlist data (optional)
        host_description (str): Host's description of the room (optional)
        
    Returns:
        dict: Contains suggested moderation criteria and examples
    """
    # Prepare playlist information if available
    playlist_info = ""
    if playlist_data and len(playlist_data) > 0:
        playlist_info = "Current playlist contains:\n"
        # Limit to 10 songs to avoid token limits
        for i, song in enumerate(playlist_data[:10]):
            playlist_info += f"- {song.get('title', 'Unknown')} by {song.get('artist', 'Unknown')}\n"
        if len(playlist_data) > 10:
            playlist_info += f"... and {len(playlist_data) - 10} more songs\n"
    
    # Prepare host description if available
    host_info = ""
    if host_description:
        host_info = f"Host's description: {host_description}\n"
    
    prompt = f"""
    You are a helpful AI assistant that helps playlist hosts create moderation criteria for their music rooms.
    Based on the information provided, suggest moderation criteria that the host might want to use.
    
    ROOM NAME: {room_name}
    
    {host_info}
    {playlist_info}
    
    Please provide moderation suggestions in the following JSON format:
    {{"suggested_criteria": "<a paragraph describing suggested moderation criteria>", 
      "examples": ["<example criterion 1>", "<example criterion 2>", "<example criterion 3>", "<example criterion 4>", "<example criterion 5>"],
      "suggested_genres": ["<genre 1>", "<genre 2>", "<genre 3>"],
      "suggested_moods": ["<mood 1>", "<mood 2>", "<mood 3>"],
      "suggested_energy_levels": ["<energy level 1>", "<energy level 2>", "<energy level 3>"]}}")
    
    The suggestions should help the host define what kinds of songs they want to allow in their playlist.
    Focus on genres, moods, energy levels, themes, and any other relevant musical attributes.
    """
    
    try:
        response = gpt.personal_gpt(prompt)
        logger.info(f"LLM moderation hints for room {room_name}: {response}")
        
        # Extract the JSON part from the response
        try:
            # Try to parse the entire response as JSON first
            result = json.loads(response)
        except json.JSONDecodeError:
            # If that fails, try to extract JSON from the text
            import re
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                try:
                    result = json.loads(json_match.group(0))
                except json.JSONDecodeError:
                    # If JSON extraction fails, create a default response
                    logger.error(f"Failed to parse JSON from LLM response: {response}")
                    result = {
                        "suggested_criteria": "Consider focusing on songs that match the mood and theme of your room.",
                        "examples": [
                            "Only upbeat songs with positive lyrics",
                            "Focus on indie rock and alternative genres",
                            "Songs with high energy for workout sessions",
                            "Relaxing instrumental tracks for study sessions",
                            "Classic hits from the 80s and 90s"
                        ],
                        "suggested_genres": ["Pop", "Rock", "Electronic"],
                        "suggested_moods": ["Upbeat", "Relaxed", "Energetic"],
                        "suggested_energy_levels": ["High", "Medium", "Low"]
                    }
            else:
                # No JSON-like structure found
                logger.error(f"No JSON found in LLM response: {response}")
                result = {
                    "suggested_criteria": "Consider focusing on songs that match the mood and theme of your room.",
                    "examples": [
                        "Only upbeat songs with positive lyrics",
                        "Focus on indie rock and alternative genres",
                        "Songs with high energy for workout sessions",
                        "Relaxing instrumental tracks for study sessions",
                        "Classic hits from the 80s and 90s"
                    ],
                    "suggested_genres": ["Pop", "Rock", "Electronic"],
                    "suggested_moods": ["Upbeat", "Relaxed", "Energetic"],
                    "suggested_energy_levels": ["High", "Medium", "Low"]
                }
        
        # Ensure the result has all required fields
        if "suggested_criteria" not in result:
            result["suggested_criteria"] = "Consider focusing on songs that match the mood and theme of your room."
        if "examples" not in result or not result["examples"]:
            result["examples"] = [
                "Only upbeat songs with positive lyrics",
                "Focus on indie rock and alternative genres",
                "Songs with high energy for workout sessions",
                "Relaxing instrumental tracks for study sessions",
                "Classic hits from the 80s and 90s"
            ]
        if "suggested_genres" not in result or not result["suggested_genres"]:
            result["suggested_genres"] = ["Pop", "Rock", "Electronic"]
        if "suggested_moods" not in result or not result["suggested_moods"]:
            result["suggested_moods"] = ["Upbeat", "Relaxed", "Energetic"]
        if "suggested_energy_levels" not in result or not result["suggested_energy_levels"]:
            result["suggested_energy_levels"] = ["High", "Medium", "Low"]
            
        return result
        
    except Exception as e:
        logger.error(f"Error in llm_generate_moderation_hints: {str(e)}")
        return {
            "suggested_criteria": "Consider focusing on songs that match the mood and theme of your room.",
            "examples": [
                "Only upbeat songs with positive lyrics",
                "Focus on indie rock and alternative genres",
                "Songs with high energy for workout sessions",
                "Relaxing instrumental tracks for study sessions",
                "Classic hits from the 80s and 90s"
            ],
            "suggested_genres": ["Pop", "Rock", "Electronic"],
            "suggested_moods": ["Upbeat", "Relaxed", "Energetic"],
            "suggested_energy_levels": ["High", "Medium", "Low"]
        }