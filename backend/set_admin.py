#!/usr/bin/env python3
"""
Script to set a user as an admin in Redis.
Default admin users are defined in the ADMIN_USERS list in app.py.
"""

import redis
import sys
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def set_admin_user(username=None):
    """
    Set a user as an admin in Redis.
    
    Args:
        username (str, optional): Username to set as admin. 
                                 If not provided, will use the first argument from command line
                                 or default to 'vincentliux' if no arguments provided.
    """
    try:
        # Connect to Redis
        redis_client = redis.Redis(host='localhost', port=6379, db=0)
        
        # Get username from command line if not provided
        if username is None:
            username = sys.argv[1] if len(sys.argv) > 1 else 'vincentliux'
        
        # Check if user exists
        user_key = f"user:{username}"
        if not redis_client.exists(user_key):
            logger.warning(f"User {username} does not exist in Redis. Creating a basic user record.")
            # Create a basic user record if it doesn't exist
            redis_client.hset(user_key, "username", username)
            redis_client.hset(user_key, "email", f"{username}@example.com")
        
        # Set admin flag
        redis_client.hset(user_key, "is_admin", "true")
        
        # Verify the change
        is_admin = redis_client.hget(user_key, "is_admin")
        if is_admin and is_admin.decode('utf-8') == 'true':
            logger.info(f"Successfully set {username} as admin")
            return True
        else:
            logger.error(f"Failed to set {username} as admin")
            return False
            
    except Exception as e:
        logger.error(f"Error setting admin user: {str(e)}")
        return False

if __name__ == "__main__":
    set_admin_user()
