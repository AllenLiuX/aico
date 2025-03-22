#!/usr/bin/env python3
import json
import redis
import logging
from pathlib import Path
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Redis configuration
REDIS_HOST = 'localhost'
REDIS_PORT = 6379
redis_version = '_v1'  # Same as in app.py

# Define paths
BASE_DIR = Path(__file__).parent.parent  # This gets you to aico/
FRONTEND_DIR = BASE_DIR / 'frontend' / 'react_dj'
STATIC_DIR = FRONTEND_DIR / 'public' / 'static'
AVATARS_DIR = STATIC_DIR / 'avatars'

logger.info(f"Using avatars directory: {AVATARS_DIR}")

# Connect to Redis
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

def get_hash(hash_name, key):
    """Get a hash value from Redis."""
    return redis_client.hget(hash_name, key)

def write_hash(hash_name, key, value):
    """Write a hash value to Redis."""
    return redis_client.hset(hash_name, key, value)

def get_all_hash_keys(hash_name):
    """Get all keys from a hash in Redis."""
    return redis_client.hkeys(hash_name)

def migrate_user_profiles():
    """Migrate user profiles to new format."""
    logger.info("Starting user profile migration...")
    
    # Get all user profiles
    profile_keys = get_all_hash_keys(f"user_profiles{redis_version}")
    migrated_count = 0
    error_count = 0
    
    for username in profile_keys:
        try:
            profile_json = get_hash(f"user_profiles{redis_version}", username)
            if not profile_json:
                continue
                
            profile = json.loads(profile_json)
            
            # Check if profile needs migration
            if 'avatar' in profile and 'has_avatar' not in profile:
                # Check if user has actual avatar files
                avatar_files = []
                # Check in frontend static directory
                avatar_files.extend(list(AVATARS_DIR.glob(f"{username}_*.jpg")))
                # Check in backend directory
                backend_avatars = Path(__file__).parent / 'avatars'
                if backend_avatars.exists():
                    avatar_files.extend(list(backend_avatars.glob(f"{username}_*.jpg")))
                
                has_avatar = len(avatar_files) > 0
                
                # Create new profile format
                new_profile = {
                    "username": username,
                    "email": profile.get("email"),
                    "created_at": profile.get("created_at", datetime.now().isoformat()),
                    "has_avatar": has_avatar,
                    # Copy any other fields except 'avatar'
                    **{k: v for k, v in profile.items() if k not in ['avatar', 'username', 'email', 'created_at']}
                }
                
                # Save updated profile
                write_hash(f"user_profiles{redis_version}", username, json.dumps(new_profile))
                migrated_count += 1
                logger.info(f"Migrated profile for {username}")
        
        except Exception as e:
            logger.error(f"Error migrating profile for {username}: {str(e)}")
            error_count += 1
    
    logger.info(f"Migration complete. Migrated {migrated_count} profiles. Errors: {error_count}")

def migrate_room_hosts():
    """Migrate room host data to use new avatar URL format."""
    logger.info("Starting room host migration...")
    
    # Get all rooms
    room_keys = get_all_hash_keys(f"rooms{redis_version}")
    migrated_count = 0
    error_count = 0
    
    for room_name in room_keys:
        try:
            room_json = get_hash(f"rooms{redis_version}", room_name)
            if not room_json:
                continue
                
            room = json.loads(room_json)
            
            # Check if room has host data
            if 'host' in room:
                host = room['host']
                if isinstance(host, dict) and 'username' in host:
                    # Update host avatar URL to new format
                    host['avatar_url'] = f"/api/avatar/{host['username']}"
                    room['host'] = host
                    
                    # Save updated room data
                    write_hash(f"rooms{redis_version}", room_name, json.dumps(room))
                    migrated_count += 1
                    logger.info(f"Migrated host data for room {room_name}")
        
        except Exception as e:
            logger.error(f"Error migrating room {room_name}: {str(e)}")
            error_count += 1
    
    logger.info(f"Migration complete. Migrated {migrated_count} rooms. Errors: {error_count}")

def verify_user_profiles():
    """Verify user profiles are in the correct format."""
    logger.info("Verifying user profiles...")
    
    # Get all user profiles
    profile_keys = get_all_hash_keys(f"user_profiles{redis_version}")
    
    for username in profile_keys:
        try:
            profile_json = get_hash(f"user_profiles{redis_version}", username)
            if not profile_json:
                continue
                
            profile = json.loads(profile_json)
            logger.info(f"\nProfile for {username}:")
            logger.info(json.dumps(profile, indent=2))
            
            # Verify profile format
            if 'avatar' in profile:
                logger.warning(f"Profile for {username} still has old 'avatar' field!")
            
            # Check for avatar files
            avatar_files = list(AVATARS_DIR.glob(f"{username}_*.jpg"))
            if avatar_files:
                logger.info(f"Found {len(avatar_files)} avatar files for {username}:")
                for f in avatar_files:
                    logger.info(f"  - {f.name}")
                    
                # Update profile if needed
                if not profile.get('has_avatar'):
                    logger.info(f"Updating has_avatar flag for {username}")
                    profile['has_avatar'] = True
                    write_hash(f"user_profiles{redis_version}", username, json.dumps(profile))
                    logger.info("Profile updated with has_avatar=True")
            else:
                logger.info(f"No avatar files found for {username}")
                if profile.get('has_avatar'):
                    logger.warning(f"Profile claims has_avatar=True but no files found!")
        
        except Exception as e:
            logger.error(f"Error verifying profile for {username}: {str(e)}")

def verify_room_hosts():
    """Verify room host data is using the correct avatar URL format."""
    logger.info("\nVerifying room hosts...")
    
    # Get all rooms
    room_keys = get_all_hash_keys(f"rooms{redis_version}")
    
    for room_name in room_keys:
        try:
            room_json = get_hash(f"rooms{redis_version}", room_name)
            if not room_json:
                continue
                
            room = json.loads(room_json)
            
            # Check if room has host data
            if 'host' in room:
                host = room['host']
                logger.info(f"\nRoom {room_name} host data:")
                logger.info(json.dumps(host, indent=2))
                
                if isinstance(host, dict):
                    if 'username' in host:
                        if 'avatar_url' in host:
                            expected_url = f"/api/avatar/{host['username']}"
                            if host['avatar_url'] != expected_url:
                                logger.warning(f"Room {room_name} has incorrect avatar URL format!")
                                logger.warning(f"  Expected: {expected_url}")
                                logger.warning(f"  Found: {host['avatar_url']}")
                                
                                # Update the URL
                                host['avatar_url'] = expected_url
                                room['host'] = host
                                write_hash(f"rooms{redis_version}", room_name, json.dumps(room))
                                logger.info("Updated room host avatar URL")
                    else:
                        logger.warning(f"Room {room_name} host missing username!")
        
        except Exception as e:
            logger.error(f"Error verifying room {room_name}: {str(e)}")

if __name__ == '__main__':
    logger.info("Starting avatar data migration...")
    migrate_user_profiles()
    migrate_room_hosts()
    logger.info("Migration completed successfully")
    logger.info("Starting data verification...")
    verify_user_profiles()
    verify_room_hosts()
    logger.info("Verification completed")
