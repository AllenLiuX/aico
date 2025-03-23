from app import get_hash, redis_version
import json
import logging

logging.basicConfig(level=logging.INFO)

# User to check
username = 'vincentliux'

# Get favorites for the user
favorites_json = get_hash(f'user_favorites{redis_version}', username)
print(f'Raw favorites from Redis for {username}: {favorites_json}')

favorites = json.loads(favorites_json) if favorites_json else []
print(f'Parsed favorites: {favorites}')

# Check if each room exists in Redis
print("\nChecking if rooms exist in Redis:")
for room_name in favorites:
    room_data = get_hash(f'rooms{redis_version}', room_name)
    if room_data:
        room_info = json.loads(room_data)
        print(f'Room {room_name}: Exists - Creator: {room_info.get("creator", "Unknown")}')
    else:
        print(f'Room {room_name}: Not found')
