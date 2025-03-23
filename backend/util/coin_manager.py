#!/usr/bin/env python3
"""
Unified coin management system for Aico.
This module handles all coin-related operations, ensuring consistency across the application.
"""

import json
import logging
from util.redis_api import get_hash, write_hash, get_user_data, set_user_data, redis_version
from util import user_logging

# Set up logging
logger = logging.getLogger(__name__)

def get_user_coins(username):
    """
    Get a user's current coin balance.
    
    Args:
        username (str): Username to get coins for
        
    Returns:
        int: Current coin balance
    """
    try:
        # Get user data (primary storage)
        user_data = get_user_data(username)
        
        # If coins exists in user_data, return that value
        if 'coins' in user_data:
            return int(user_data.get('coins', 0))
        
        # Fallback to user_profiles if not in user_data
        profile_json = get_hash(f"user_profiles{redis_version}", username)
        if profile_json:
            profile = json.loads(profile_json) if isinstance(profile_json, str) else json.loads(profile_json.decode('utf-8'))
            coins = profile.get('coins', 0)
            
            # Sync to user_data for future requests
            user_data['coins'] = coins
            set_user_data(username, user_data)
            
            return int(coins)
        
        # Default to 0 if no coins found
        return 0
    except Exception as e:
        logger.error(f"Error getting coins for user {username}: {str(e)}")
        return 0

def set_user_coins(username, coins, reason=None):
    """
    Set a user's coin balance to a specific amount.
    
    Args:
        username (str): Username to set coins for
        coins (int): New coin balance
        reason (str, optional): Reason for the change
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        coins = int(coins)
        previous_coins = get_user_coins(username)
        
        # Update user_data (primary storage)
        user_data = get_user_data(username)
        user_data['coins'] = coins
        set_user_data(username, user_data)
        
        # Update user_profiles for backward compatibility
        profile_json = get_hash(f"user_profiles{redis_version}", username)
        if profile_json:
            profile = json.loads(profile_json) if isinstance(profile_json, str) else json.loads(profile_json.decode('utf-8'))
            profile['coins'] = coins
            write_hash(f"user_profiles{redis_version}", username, json.dumps(profile))
        
        # Log the activity
        if reason:
            user_logging.log_user_activity(
                username=username,
                action="coin_balance_update",
                details={
                    "previous_coins": previous_coins,
                    "new_coins": coins,
                    "reason": reason
                }
            )
        
        logger.info(f"Set coins for user {username} to {coins} (was {previous_coins})")
        return True
    except Exception as e:
        logger.error(f"Error setting coins for user {username}: {str(e)}")
        return False

def add_user_coins(username, amount, reason=None):
    """
    Add coins to a user's balance.
    
    Args:
        username (str): Username to add coins for
        amount (int): Amount of coins to add
        reason (str, optional): Reason for the addition
        
    Returns:
        int: New coin balance
    """
    try:
        amount = int(amount)
        current_coins = get_user_coins(username)
        new_coins = current_coins + amount
        
        if set_user_coins(username, new_coins, reason):
            return new_coins
        return current_coins
    except Exception as e:
        logger.error(f"Error adding coins for user {username}: {str(e)}")
        return get_user_coins(username)

def use_user_coins(username, amount, feature=None):
    """
    Use (deduct) coins from a user's balance.
    
    Args:
        username (str): Username to deduct coins from
        amount (int): Amount of coins to use
        feature (str, optional): Feature the coins were used for
        
    Returns:
        dict: Result with success status and new balance
    """
    try:
        amount = int(amount)
        current_coins = get_user_coins(username)
        
        if current_coins < amount:
            return {
                "success": False,
                "error": "Insufficient coins",
                "coins": current_coins,
                "required": amount
            }
        
        new_coins = current_coins - amount
        reason = f"Used for {feature}" if feature else "Used coins"
        
        if set_user_coins(username, new_coins, reason):
            return {
                "success": True,
                "coins": new_coins,
                "used": amount
            }
        
        return {
            "success": False,
            "error": "Failed to update coins",
            "coins": current_coins
        }
    except Exception as e:
        logger.error(f"Error using coins for user {username}: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "coins": get_user_coins(username)
        }

def check_coin_balance(username):
    """
    Check if there's a mismatch between storage methods and fix if needed.
    
    Args:
        username (str): Username to check
        
    Returns:
        dict: Information about the user's coin balance
    """
    result = {
        "username": username,
        "user_profiles_coins": None,
        "user_data_coins": None,
        "mismatch": False,
        "fixed": False
    }
    
    try:
        # Check in user_profiles
        profile_json = get_hash(f"user_profiles{redis_version}", username)
        if profile_json:
            profile = json.loads(profile_json) if isinstance(profile_json, str) else json.loads(profile_json.decode('utf-8'))
            result["user_profiles_coins"] = profile.get('coins', 0)
        
        # Check in user data
        user_data = get_user_data(username)
        result["user_data_coins"] = user_data.get('coins', 0)
        
        # Check if there's a mismatch
        if result["user_profiles_coins"] is not None and result["user_data_coins"] is not None:
            if str(result["user_profiles_coins"]) != str(result["user_data_coins"]):
                result["mismatch"] = True
                
                # Fix the mismatch by using the higher value
                coins = max(int(result["user_profiles_coins"]), int(result["user_data_coins"]))
                if set_user_coins(username, coins, "Fixed coin mismatch"):
                    result["fixed"] = True
                    result["new_coins"] = coins
        
        return result
    except Exception as e:
        logger.error(f"Error checking coin balance for user {username}: {str(e)}")
        result["error"] = str(e)
        return result
