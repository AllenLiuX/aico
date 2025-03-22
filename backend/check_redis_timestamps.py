#!/usr/bin/env python3
import json
import redis
import os
from datetime import datetime

# Redis configuration - directly use the configuration values
redis_host = os.environ.get('REDIS_HOST', 'localhost')
redis_port = int(os.environ.get('REDIS_PORT', 6379))
redis_db = int(os.environ.get('REDIS_DB', 0))
redis_password = os.environ.get('REDIS_PASSWORD', None)
redis_version = '_v1'  # Hardcoded to match the correct version

# Create Redis client
redis_client = redis.Redis(
    host=redis_host,
    port=redis_port,
    db=redis_db,
    password=redis_password,
    decode_responses=False  # We'll handle decoding manually
)

def test_timestamp_formatting():
    """Test our timestamp formatting code with real data from Redis"""
    print("Testing timestamp formatting with real data from Redis...")
    
    # Connect to database 0 where we found the logs
    r = redis.Redis(
        host=redis_host,
        port=redis_port,
        db=0,
        password=redis_password,
        decode_responses=False
    )
    
    # Get a sample entry from global_logs_v1
    global_log_key = f"global_logs{redis_version}"
    sample = r.zrevrange(global_log_key, 0, 0)
    
    if not sample:
        print("No sample found in global logs")
        return
        
    try:
        # Parse the sample
        log_data = json.loads(sample[0].decode('utf-8'))
        print(f"Original log entry: {json.dumps(log_data, indent=2)}")
        
        # Test our formatting code
        if 'timestamp' in log_data:
            original_timestamp = log_data['timestamp']
            print(f"Original timestamp: {original_timestamp}")
            
            try:
                # Apply our formatting code
                dt = datetime.fromisoformat(original_timestamp)
                formatted_timestamp = dt.strftime('%Y-%m-%d %H:%M:%S')
                print(f"Formatted timestamp: {formatted_timestamp}")
                
                # Update the log entry with the formatted timestamp
                log_data['timestamp'] = formatted_timestamp
                print(f"Updated log entry: {json.dumps(log_data, indent=2)}")
                
                print("\nThis is what should be returned by our API endpoints.")
                print("If the frontend is still showing 'Invalid Date', the issue might be:")
                print("1. The server hasn't been restarted to apply our code changes")
                print("2. The frontend is trying to parse the timestamp in a way that's incompatible with our format")
                print("3. There might be a caching issue in the frontend")
            except ValueError as e:
                print(f"Error formatting timestamp: {str(e)}")
    except Exception as e:
        print(f"Error processing sample: {str(e)}")

def scan_redis_for_logs():
    """Scan all Redis keys to find log-related keys"""
    print("Scanning Redis for log-related keys...")
    
    # Check multiple databases
    for db in range(16):  # Check databases 0-15
        print(f"\nChecking Redis database {db}...")
        r = redis.Redis(
            host=redis_host,
            port=redis_port,
            db=db,
            password=redis_password,
            decode_responses=False
        )
        
        # Scan for keys
        cursor = 0
        log_keys = []
        
        while True:
            cursor, keys = r.scan(cursor, match="*log*", count=100)
            for key in keys:
                key_str = key.decode('utf-8')
                log_keys.append(key_str)
                
            if cursor == 0:
                break
                
        if log_keys:
            print(f"Found {len(log_keys)} log-related keys in database {db}:")
            for key in log_keys:
                print(f"  - {key}")
                
                # Check key type
                key_type = r.type(key).decode('utf-8')
                print(f"    Type: {key_type}")
                
                # For sorted sets, get the count
                if key_type == 'zset':
                    count = r.zcard(key)
                    print(f"    Count: {count}")
                    
                    if count > 0:
                        # Check a sample entry
                        sample = r.zrevrange(key, 0, 0)
                        if sample:
                            try:
                                sample_data = json.loads(sample[0].decode('utf-8'))
                                print(f"    Sample entry: {json.dumps(sample_data, indent=2)[:200]}...")
                                
                                # Check for timestamp
                                if 'timestamp' in sample_data:
                                    print(f"    Timestamp: {sample_data['timestamp']}")
                                    print(f"    Timestamp type: {type(sample_data['timestamp'])}")
                                    
                                    # Try to parse the timestamp
                                    try:
                                        dt = datetime.fromisoformat(sample_data['timestamp'])
                                        print(f"    Parsed timestamp: {dt.strftime('%Y-%m-%d %H:%M:%S')}")
                                        print("    Timestamp is valid ISO format")
                                    except ValueError as e:
                                        print(f"    Error parsing timestamp: {str(e)}")
                                        print("    Timestamp is NOT valid ISO format")
                            except Exception as e:
                                print(f"    Error processing sample: {str(e)}")
        else:
            print(f"No log-related keys found in database {db}")

def check_redis_timestamps(db_num=0, key_name=None):
    """Check the format of timestamps stored in Redis global logs"""
    try:
        # Connect to the specified database
        r = redis.Redis(
            host=redis_host,
            port=redis_port,
            db=db_num,
            password=redis_password,
            decode_responses=False
        )
        
        # Get the global logs key
        if key_name is None:
            key_name = f"global_logs{redis_version}"
            
        print(f"Checking timestamps in Redis key: {key_name} (DB: {db_num})")
        
        # Check if key exists
        if not r.exists(key_name):
            print(f"Key {key_name} does not exist in database {db_num}")
            return
            
        # Get key type
        key_type = r.type(key_name).decode('utf-8')
        print(f"Key type: {key_type}")
        
        if key_type != 'zset':
            print(f"Key {key_name} is not a sorted set, cannot process as logs")
            return
        
        # Get all logs from sorted set (newest first, limit to 10 for brevity)
        all_log_entries = r.zrevrange(key_name, 0, 10)
        
        if not all_log_entries:
            print("No log entries found in Redis.")
            return
            
        print(f"Found {len(all_log_entries)} log entries.")
        
        # Parse and print the timestamp format for each entry
        for i, entry in enumerate(all_log_entries):
            try:
                log_data = json.loads(entry.decode('utf-8'))
                timestamp = log_data.get('timestamp', 'No timestamp found')
                action = log_data.get('action', 'No action found')
                username = log_data.get('username', 'No username found')
                
                print(f"\nEntry {i+1}:")
                print(f"  Action: {action}")
                print(f"  Username: {username}")
                print(f"  Timestamp: {timestamp}")
                print(f"  Timestamp type: {type(timestamp)}")
                
                # Try to parse the timestamp to see if it's valid
                if timestamp != 'No timestamp found':
                    try:
                        dt = datetime.fromisoformat(timestamp)
                        print(f"  Parsed timestamp: {dt.strftime('%Y-%m-%d %H:%M:%S')}")
                        print("  Timestamp is valid ISO format")
                    except ValueError as e:
                        print(f"  Error parsing timestamp: {str(e)}")
                        print("  Timestamp is NOT valid ISO format")
            except Exception as e:
                print(f"Error processing entry {i+1}: {str(e)}")
    
    except Exception as e:
        print(f"Error checking Redis timestamps: {str(e)}")

if __name__ == "__main__":
    # First test our timestamp formatting code
    test_timestamp_formatting()
    
    # Then scan for log-related keys
    scan_redis_for_logs()
    
    # Then check specific keys if found
    check_redis_timestamps(db_num=0, key_name="global_logs_v1")
