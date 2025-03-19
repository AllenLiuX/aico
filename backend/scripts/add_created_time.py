#!/usr/bin/env python3
import sys
import os
import json
import redis
import logging
from pathlib import Path
from datetime import datetime

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

def add_created_at_to_rooms():
    """Add created_at field to existing room host data that don't have it."""
    key = f"room_hosts{redis_version}"
    
    # Create backup first
    logger.info("Creating backup of room host data...")
    hosts_data = backup_redis_data(key)
    
    if not hosts_data:
        logger.error("No data found in room_hosts key. Aborting migration.")
        return False
    
    # Default timestamp for existing rooms (current time)
    default_timestamp = datetime.strptime('2025-01-01', '%Y-%m-%d').isoformat()
    
    try:
        # Update each room's host data
        rooms_updated = 0
        for room_name, host_json in hosts_data.items():
            try:
                # Parse the existing host data
                host_data = json.loads(host_json)
                
                # Add created_at if it doesn't exist
                if "created_at" not in host_data:
                    host_data["created_at"] = default_timestamp
                    
                    # Write updated data back to Redis
                    write_hash(key, room_name, json.dumps(host_data))
                    logger.info(f"Added created_at to room: {room_name}")
                    rooms_updated += 1
                
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON data for room {room_name}")
                continue
            except Exception as e:
                logger.error(f"Error updating room {room_name}: {str(e)}")
                continue
        
        logger.info(f"Migration completed successfully! Updated {rooms_updated} rooms.")
        return True
        
    except Exception as e:
        logger.error(f"Error during migration: {str(e)}")
        return False

def verify_migration():
    """Verify that all rooms have the created_at field."""
    key = f"room_hosts{redis_version}"
    hosts_data = get_all_hash(key)
    
    missing_count = 0
    for room_name, host_json in hosts_data.items():
        try:
            host_data = json.loads(host_json)
            if "created_at" not in host_data:
                logger.error(f"Room {room_name} still missing created_at field")
                missing_count += 1
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON data for room {room_name}")
            continue
    
    if missing_count == 0:
        logger.info("All rooms have created_at field!")
        return True
    else:
        logger.error(f"{missing_count} rooms are missing created_at field")
        return False

def main():
    """Main function to run the migration process."""
    logger.info("Starting migration to ensure all rooms have created_at field...")
    
    # Step 1: Add created_at field to existing rooms that don't have it
    if add_created_at_to_rooms():
        logger.info("Successfully added created_at field to rooms that needed it")
    else:
        logger.error("Failed to add created_at field to rooms")
        return
    
    # Step 2: Verify migration
    if verify_migration():
        logger.info("Migration verification successful")
    else:
        logger.warning("Migration verification failed - some rooms may still be missing created_at")

if __name__ == "__main__":
    main()
