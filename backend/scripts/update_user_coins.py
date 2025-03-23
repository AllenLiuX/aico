#!/usr/bin/env python3
"""
Script to update all users to have 1000 coins by default.
This script should be run once to update existing users.
"""

import sys
import os
import json
import logging

# Add the parent directory to the path so we can import the app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from util.redis_api import get_all_hash, get_hash, write_hash, redis_version, redis_client
from util.coin_manager import get_user_coins, set_user_coins, check_coin_balance
from util.user_logging import log_user_activity

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def update_all_users_coins():
    """Update all users to have 1000 coins by default"""
    try:
        # Get all user profiles
        user_profiles = get_all_hash(f"user_profiles{redis_version}")
        
        if not user_profiles:
            logger.info("No user profiles found")
            return
        
        updated_count = 0
        skipped_count = 0
        
        logger.info(f"Found {len(user_profiles)} user profiles")
        
        for username, profile_json in user_profiles.items():
            try:
                # Decode username if it's bytes
                if isinstance(username, bytes):
                    username = username.decode('utf-8')
                
                # Get current coins using the unified system
                current_coins = get_user_coins(username)
                
                # Update to 1000 coins
                if set_user_coins(username, 1000, "Default coin allocation"):
                    updated_count += 1
                    logger.info(f"Updated user {username}: coins set to 1000 (was {current_coins})")
                else:
                    skipped_count += 1
                    logger.warning(f"Failed to update coins for user {username}")
                
            except Exception as e:
                logger.error(f"Error updating user {username}: {str(e)}")
                skipped_count += 1
        
        logger.info(f"Update complete: {updated_count} users updated, {skipped_count} users skipped")
        
    except Exception as e:
        logger.error(f"Error updating user coins: {str(e)}")
        return False
    
    return True

def check_user_coins(username):
    """
    Check a specific user's coin balance in both storage locations
    
    Args:
        username (str): Username to check
        
    Returns:
        dict: Information about the user's coin balance
    """
    result = check_coin_balance(username)
    
    # Add sessions information
    result["sessions"] = []
    try:
        # Find active sessions for this user
        all_sessions = redis_client.hgetall(f"sessions{redis_version}")
        for token, user in all_sessions.items():
            if isinstance(user, bytes):
                user = user.decode('utf-8')
            if user == username:
                result["sessions"].append(token.decode('utf-8') if isinstance(token, bytes) else token)
    except Exception as e:
        logger.error(f"Error getting sessions for user {username}: {str(e)}")
    
    return result

def fix_user_coins(username, coins=None):
    """
    Fix a user's coin balance by syncing between storage methods
    
    Args:
        username (str): Username to fix
        coins (int, optional): Specific coin amount to set. If None, will use the higher value from existing storage.
        
    Returns:
        dict: Information about the update
    """
    logger.info(f"Fixing coin balance for user {username}")
    
    # Get current values before fixing
    user_info = check_coin_balance(username)
    previous_user_profiles_coins = user_info["user_profiles_coins"]
    previous_user_data_coins = user_info["user_data_coins"]
    
    # Determine the coin value to set
    if coins is not None:
        new_coins = coins
    elif user_info["user_profiles_coins"] is not None and user_info["user_data_coins"] is not None:
        # Use the higher value
        new_coins = max(int(user_info["user_profiles_coins"]), int(user_info["user_data_coins"]))
    elif user_info["user_profiles_coins"] is not None:
        new_coins = int(user_info["user_profiles_coins"])
    elif user_info["user_data_coins"] is not None:
        new_coins = int(user_info["user_data_coins"])
    else:
        new_coins = 0
    
    # Use the unified system to set the coins
    success = set_user_coins(username, new_coins, "Coin balance fix")
    
    # Log the activity
    log_user_activity(
        username=username,
        action="coin_balance_fix",
        details={
            "previous_user_profiles_coins": previous_user_profiles_coins,
            "previous_user_data_coins": previous_user_data_coins,
            "new_coins": new_coins
        }
    )
    
    return {
        "username": username,
        "previous_user_profiles_coins": previous_user_profiles_coins,
        "previous_user_data_coins": previous_user_data_coins,
        "new_coins": new_coins,
        "success": success
    }

def list_all_users():
    """
    List all users in the system with their coin balances
    
    Returns:
        list: List of user information
    """
    try:
        # Get all user profiles
        user_profiles = get_all_hash(f"user_profiles{redis_version}")
        
        if not user_profiles:
            logger.info("No user profiles found")
            return []
        
        users = []
        
        for username, profile_json in user_profiles.items():
            try:
                # Decode username if it's bytes
                if isinstance(username, bytes):
                    username = username.decode('utf-8')
                
                # Get coin balance using the unified system
                coins = get_user_coins(username)
                
                users.append({
                    "username": username,
                    "coins": coins
                })
                
            except Exception as e:
                logger.error(f"Error getting info for user {username}: {str(e)}")
        
        return users
    except Exception as e:
        logger.error(f"Error listing users: {str(e)}")
        return []

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='User Coins Management Tool')
    
    # Add arguments
    parser.add_argument('--update-all', action='store_true', help='Update all users to have 1000 coins')
    parser.add_argument('--check', metavar='USERNAME', help='Check a specific user\'s coin balance')
    parser.add_argument('--fix', metavar='USERNAME', help='Fix a specific user\'s coin balance')
    parser.add_argument('--list', action='store_true', help='List all users with their coin balances')
    parser.add_argument('--set-coins', metavar='AMOUNT', type=int, help='Set a specific coin amount when using --fix')
    
    args = parser.parse_args()
    
    if args.update_all:
        logger.info("Updating all users to have 1000 coins")
        if update_all_users_coins():
            logger.info("Successfully updated all users")
        else:
            logger.error("Failed to update all users")
    
    elif args.check:
        logger.info(f"Checking coin balance for user {args.check}")
        result = check_user_coins(args.check)
        logger.info(f"Result: {result}")
    
    elif args.fix:
        coins = args.set_coins if args.set_coins is not None else None
        result = fix_user_coins(args.fix, coins)
        logger.info(f"Result: {result}")
    
    elif args.list:
        logger.info("Listing all users with their coin balances")
        users = list_all_users()
        
        if not users:
            logger.info("No users found")
        else:
            logger.info(f"Found {len(users)} users")
            for user in users:
                logger.info(f"User: {user['username']}, Coins: {user['coins']}")
    
    else:
        parser.print_help()
