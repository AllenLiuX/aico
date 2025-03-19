#!/usr/bin/env python3
import sys
import os
import json
import redis
import logging
from pathlib import Path

# Add the parent directory to Python path to import redis_api
sys.path.append(str(Path(__file__).parent.parent))
from util.redis_api import get_hash, write_hash, get_all_hash, delete_hash

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Redis configuration
redis_client = redis.Redis(host='localhost', port=6379, db=0)
redis_version = '_v1'  # Make sure this matches your app's redis_version

def backup_redis_data(key_pattern):
    """Create a backup of Redis data for a given key pattern."""
    backup = {}
    try:
        all_data = get_all_hash(key_pattern)
        backup_file = f'redis_backup_{key_pattern}_{redis_version}.json'
        
        with open(backup_file, 'w') as f:
            json.dump(all_data, f, indent=2)
        
        logger.info(f"Backup created successfully: {backup_file}")
        return all_data
    except Exception as e:
        logger.error(f"Error creating backup: {str(e)}")
        return None

def migrate_playlist_keys():
    """Migrate data from old playlist key to new room_playlists key."""
    old_key = f"playlist{redis_version}"
    new_key = f"room_playlists{redis_version}"
    
    # Create backup first
    logger.info("Creating backup of old playlist data...")
    old_data = backup_redis_data(old_key)
    
    if not old_data:
        logger.error("No data found in old playlist key. Aborting migration.")
        return False
    
    try:
        # Migrate each room's playlist
        for room_name, playlist_json in old_data.items():
            try:
                # Verify the data is valid JSON
                playlist_data = json.loads(playlist_json)
                
                # Write to new key
                write_hash(new_key, room_name, json.dumps(playlist_data))
                logger.info(f"Migrated playlist for room: {room_name}")
                
                # Optionally delete old data (commented out for safety)
                # delete_hash(old_key, room_name)
                
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON data for room {room_name}")
                continue
            except Exception as e:
                logger.error(f"Error migrating room {room_name}: {str(e)}")
                continue
        
        logger.info("Migration completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"Error during migration: {str(e)}")
        return False

def verify_migration():
    """Verify that the migration was successful by comparing old and new data."""
    old_key = f"playlist{redis_version}"
    new_key = f"room_playlists{redis_version}"
    
    old_data = get_all_hash(old_key)
    new_data = get_all_hash(new_key)
    
    # Compare number of rooms
    if len(old_data) != len(new_data):
        logger.warning(f"Number of rooms mismatch: Old ({len(old_data)}) vs New ({len(new_data)})")
    
    # Compare each room's data
    for room_name in old_data:
        if room_name not in new_data:
            logger.error(f"Room {room_name} missing from new data")
            continue
            
        try:
            old_playlist = json.loads(old_data[room_name])
            new_playlist = json.loads(new_data[room_name])
            
            if old_playlist != new_playlist:
                logger.error(f"Data mismatch for room {room_name}")
            else:
                logger.info(f"Verified room {room_name}: OK")
                
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON data for room {room_name}")
            continue

def cleanup_old_data():
    """Remove old playlist data after confirming successful migration."""
    confirm = input("Are you sure you want to delete the old playlist data? (yes/no): ")
    if confirm.lower() != 'yes':
        logger.info("Cleanup cancelled")
        return
    
    old_key = f"playlist{redis_version}"
    try:
        old_data = get_all_hash(old_key)
        for room_name in old_data:
            delete_hash(old_key, room_name)
            logger.info(f"Deleted old data for room {room_name}")
        logger.info("Cleanup completed successfully!")
    except Exception as e:
        logger.error(f"Error during cleanup: {str(e)}")

def main():
    """Main function to run the migration process."""
    print("\nRedis Data Migration Tool")
    print("------------------------")
    print("1. Create backup only")
    print("2. Migrate playlist data")
    print("3. Verify migration")
    print("4. Cleanup old data")
    print("5. Exit")
    
    choice = input("\nEnter your choice (1-5): ")
    
    if choice == '1':
        key_pattern = input("Enter key pattern to backup: ")
        backup_redis_data(key_pattern)
    elif choice == '2':
        if migrate_playlist_keys():
            print("\nMigration completed. Please run verification (option 3) next.")
    elif choice == '3':
        verify_migration()
    elif choice == '4':
        cleanup_old_data()
    elif choice == '5':
        print("Exiting...")
        sys.exit(0)
    else:
        print("Invalid choice")

if __name__ == "__main__":
    main()
