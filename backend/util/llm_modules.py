import util.gpt as gpt
import json


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