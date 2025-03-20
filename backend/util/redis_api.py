import redis
import json
import pandas as pd
import logging
import time
import os
import sys
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

redis_version = '_v1'

redis_client = redis.Redis(host='localhost', port=6379, db=0)

# Import the admin users list from app.py
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from app import ADMIN_USERS
except ImportError:
    # Fallback if import fails
    ADMIN_USERS = ['vincentliux', 'Carter']

def get_data(key):
    res = redis_client.get(key)
    if res:
        return res.decode('utf-8')
    else:
        return ''


def write_data(key, val):
    res = redis_client.set(key, val)
    # print(res)
    return res


def insert_data(key, new_val):
    val = get_data(key)
    val = val+new_val
    res = write_data(key, val)
    return res


def update_data(key, old_val, new_val):
    val = get_data(key)
    val = val.replace(old_val, new_val)
    res = write_data(key, val)
    return res


def delete_data(key, delete_val):
    val = get_data(key)
    val = val.replace(delete_val, '')
    res = write_data(key, val)
    return res

def clear_data(key):
    write_data(key, '')

def delete_key(key):
    res = redis_client.delete(key)
    return res

# ======= hash api

def write_hash(key, field, val):
    res = redis_client.hset(key, field, val)
    return res

def get_hash(key, field):
    res = redis_client.hget(key, field)
    if res:
        return res.decode('utf-8')
    else:
        return ''

def insert_hash(key, field, new_val):
    val = get_hash(key, field)
    if new_val in val:
        return
    val = val+new_val
    res = write_hash(key, field, val)
    return res

def delete_hash(key, field):
    res = redis_client.hdel(key, field)
    return res

def remove_hash(key, field, delete_val):
    val = get_hash(key, field)
    val = val.replace(delete_val, '')
    res = write_hash(key, field, val)
    return res

def write_hash_list(key, field, vals=[]):
    # val = '@@@@'.join(vals)
    val = json.dumps(vals)
    res = write_hash(key, field, val)
    return res

def get_hash_list(key, field):
    val = get_hash(key, field)
    # vals = [i for i in val.split('@@@@') if i]  # so that empty result is [] instead of [']
    # if '@@@@' in val:
    #     vals = [i for i in val.split('@@@@') if i]  # so that empty result is [] instead of [']
    # else:
    #     vals = json.loads(val)
    if val:
        vals = json.loads(val)
    else:
        vals = []
    return vals

def insert_hash_list(key, field, new_vals=[]):
    vals = get_hash_list(key, field)
    # change new_nals into list if it is a string
    if isinstance(new_vals, str):
        new_vals = [new_vals]
    
    for val in new_vals:
        if val not in vals:
            vals += [val]
    # vals += new_vals
    res = write_hash_list(key, field, vals)
    return res

def remove_hash_list(key, field, del_vals=[]):
    vals = get_hash_list(key, field)
    for i in del_vals:
        vals.remove(i)
    res = write_hash_list(key, field, vals)
    return res

def clear_hash_list(key, field):
    res = delete_hash(key, field)
    return res

def get_all_hash(key):
    res = redis_client.hgetall(key)
    if res:
        result_decoded = {k.decode('utf-8'): v.decode('utf-8') for k, v in res.items()}
        return result_decoded
    else:
        return {}

def delete_all_hash(key):
    res = redis_client.delete(key)
    return res

# ======= store dataframe
def get_df_from_redis(name, date):
    df_json = get_hash(name, date)
    df = pd.read_json(df_json, orient='split')
    return df

def df_to_redis(df, name='', date='', overwrite=True, key=['']):
    df_json = df.to_json(orient='split')
    if not overwrite:   # DEDUP
        old_df = get_df_from_redis(name, date)
        df_combined = pd.concat([df, old_df])
        df = df_combined.drop_duplicates(subset=key, keep='first')

    write_hash(name, date, df_json)

def remove_room(room_name):
    delete_hash(f"playlist{redis_version}", room_name)

def get_user_data(username):
    """
    Get user data from Redis.
    
    Args:
        username (str): Username to get data for
        
    Returns:
        dict: User data or empty dict if user not found
    """
    try:
        user_key = f"user:{username}"
        logger.info(f"Getting user data for {username} with key {user_key}")
        
        user_data = redis_client.hgetall(user_key)
        logger.info(f"Raw user data from Redis: {user_data}")
        
        # Convert bytes to strings
        result = {}
        for key, value in user_data.items():
            key_str = key.decode('utf-8')
            value_str = value.decode('utf-8')
            logger.info(f"Processing field {key_str} with value {value_str}")
            
            # Handle special fields
            if key_str == 'is_admin':
                # Ensure admin users are always admin
                if username in ADMIN_USERS:
                    result[key_str] = True
                    logger.info(f"Setting {username} as admin (admin list override)")
                else:
                    admin_status = value_str.lower() == 'true'
                    result[key_str] = admin_status
                    logger.info(f"Setting admin status for {username} to {admin_status} based on value '{value_str}'")
            else:
                result[key_str] = value_str
        
        # Ensure admin users are always admin even if not in Redis
        if username in ADMIN_USERS and 'is_admin' not in result:
            result['is_admin'] = True
            logger.info(f"Setting {username} as admin (not in Redis)")
        
        logger.info(f"Final user data for {username}: {result}")
        return result
    except Exception as e:
        logger.error(f"Error getting user data: {str(e)}")
        return {}

def set_user_data(username, user_data):
    """
    Set user data in Redis.
    
    Args:
        username (str): Username to set data for
        user_data (dict): User data to set
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        user_key = f"user:{username}"
        
        # Ensure admin users are always admin
        if username in ADMIN_USERS:
            user_data['is_admin'] = True
            
        # Convert all values to strings
        string_data = {k: str(v) for k, v in user_data.items()}
        
        redis_client.hmset(user_key, string_data)
        return True
    except Exception as e:
        logger.error(f"Error setting user data: {str(e)}")
        return False

# Room data functions
def get_room_data(room_name):
    """
    Get room data from Redis including playlist and settings.
    
    Args:
        room_name (str): Name of the room
        
    Returns:
        dict: Room data including playlist, current_index, etc.
    """
    try:
        # Get playlist data
        playlist_json = get_hash(f"room_playlists{redis_version}", room_name)
        playlist = json.loads(playlist_json) if playlist_json else []
        
        # Get player state data
        player_state_json = get_hash(f"room_player_states{redis_version}", room_name)
        player_state = json.loads(player_state_json) if player_state_json else {"state": "paused", "position": 0}
        
        # Get room settings
        settings_json = get_hash(f"room_settings{redis_version}", room_name)
        settings = json.loads(settings_json) if settings_json else {}
        
        # Combine all data
        room_data = {
            "playlist": playlist,
            "current_index": settings.get("current_index", 0),
            "player_state": player_state.get("state", "paused"),
            "position": player_state.get("position", 0),
            "settings": settings
        }
        
        return room_data
    except Exception as e:
        logger.error(f"Error getting room data for {room_name}: {str(e)}")
        return {"playlist": [], "current_index": 0, "player_state": "paused", "position": 0, "settings": {}}

def update_room_player_state(room_name, state, position):
    """
    Update the player state for a room.
    
    Args:
        room_name (str): Name of the room
        state (str): Player state (playing, paused, etc.)
        position (float): Current playback position in seconds
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        player_state = {
            "state": state,
            "position": position,
            "updated_at": int(time.time())
        }
        
        # Store player state in Redis
        write_hash(f"room_player_states{redis_version}", room_name, json.dumps(player_state))
        
        return True
    except Exception as e:
        logger.error(f"Error updating player state for room {room_name}: {str(e)}")
        return False

if __name__ == '__main__':
    # write_hash('test', 'test_val', 123)
    # print(get_hash("test", "test_val"))
    # print(get_all_hash('test'))

    room_name = 'eason'
    redis_version = '_v1'
    # playlist = get_hash(f"playlist{redis_version}", room_name)
    # settings = get_hash(f"settings{redis_version}", room_name)
    # introduction = get_hash(f"intro{redis_version}", room_name)

    # playlist = json.loads(get_hash(f"playlist{redis_version}", room_name))
    # settings = json.loads(get_hash(f"settings{redis_version}", room_name))
    # introduction = get_hash(f"intro{redis_version}", room_name)
    # print(f"playlist: {playlist}")
    # print(f"settings: {settings}")
    # print(f"introduction: {introduction}")    



    all_rooms = get_all_hash(f"playlist{redis_version}")
    print(all_rooms.keys())
    # remove_room('jj')
    # all_rooms = get_all_hash(f"playlist{redis_version}")
    # print(all_rooms.keys())
