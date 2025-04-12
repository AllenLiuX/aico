#!/usr/bin/env python3
"""
Test script for the coin_manager.py module.
This script tests the get_all_user_coins function.
"""

import logging
import json
from util.coin_manager import get_all_user_coins, get_user_coins, set_user_coins

# Set up logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_get_all_user_coins():
    """Test the get_all_user_coins function."""
    logger.info("Testing get_all_user_coins function...")
    
    # Get all user coins
    all_user_coins = get_all_user_coins()
    
    # Print the results
    logger.info(f"Found {len(all_user_coins)} users with coin balances")
    
    # Format the output for better readability
    print("\nUser Coin Balances:")
    print("=" * 40)
    print(f"{'Username':<20} | {'Coins':>10}")
    print("-" * 40)
    
    # Sort by username for consistent output
    for username, coins in sorted(all_user_coins.items()):
        print(f"{username:<20} | {coins:>10}")
    
    print("=" * 40)
    
    # Calculate some statistics
    if all_user_coins:
        total_coins = sum(all_user_coins.values())
        avg_coins = total_coins / len(all_user_coins)
        max_coins = max(all_user_coins.values())
        max_user = max(all_user_coins.items(), key=lambda x: x[1])[0]
        
        print(f"\nStatistics:")
        print(f"Total coins in circulation: {total_coins}")
        print(f"Average coins per user: {avg_coins:.2f}")
        print(f"User with most coins: {max_user} ({max_coins} coins)")
    
    return all_user_coins

if __name__ == "__main__":
    test_get_all_user_coins()
