import logging
import json
from flask import Blueprint, request, jsonify
from util.redis_api import get_hash, write_hash, redis_version
from util.coin_manager import get_user_coins, add_user_coins, use_user_coins

# Set up logging
logger = logging.getLogger(__name__)

coin_routes = Blueprint('coin_routes', __name__)

# Default pin price
DEFAULT_PIN_PRICE = 10

@coin_routes.route('/get-pin-price', methods=['GET'])
def get_pin_price():
    """Get the current pin price for a specific room"""
    room_name = request.args.get('room_name')
    
    if not room_name:
        return jsonify({"error": "Room name is required"}), 400
    
    try:
        # Get pin price from Redis
        pin_price_key = f"room_pin_price{redis_version}"
        pin_price = get_hash(pin_price_key, room_name)
        
        # If no price is set, use default
        if not pin_price:
            return jsonify({"price": DEFAULT_PIN_PRICE})
        
        return jsonify({"price": int(pin_price)})
    except Exception as e:
        logger.error(f"Error getting pin price: {str(e)}")
        return jsonify({"error": "Failed to get pin price", "price": DEFAULT_PIN_PRICE}), 500

@coin_routes.route('/set-pin-price', methods=['POST'])
def set_pin_price():
    """Set the pin price for a specific room (host only)"""
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({"error": "Authentication required"}), 401

    # Extract token from Authorization header
    auth_token = auth_header
    if auth_header.startswith('Bearer '):
        auth_token = auth_header[7:]  # Remove 'Bearer ' prefix

    username = get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return jsonify({"error": "Invalid session"}), 401
    
    try:
        data = request.json
        room_name = data.get('room_name')
        price = data.get('price')
        
        if not all([room_name, price]):
            return jsonify({"error": "Missing required parameters"}), 400
        
        # Validate price
        try:
            price = int(price)
            if price < 1:
                return jsonify({"error": "Price must be at least 1 coin"}), 400
        except ValueError:
            return jsonify({"error": "Price must be a valid number"}), 400
        
        # Check if user is the host of the room
        room_host = get_hash(f"room_hosts{redis_version}", room_name)
        if not room_host or room_host != username:
            return jsonify({"error": "Only the room host can set the pin price"}), 403
        
        # Set pin price in Redis
        pin_price_key = f"room_pin_price{redis_version}"
        write_hash(pin_price_key, room_name, str(price))
        
        logger.info(f"Pin price for room {room_name} set to {price} coins by {username}")
        return jsonify({"success": True, "price": price})
    except Exception as e:
        logger.error(f"Error setting pin price: {str(e)}")
        return jsonify({"error": "Failed to set pin price"}), 500

@coin_routes.route('/get-room-pin-settings', methods=['GET'])
def get_room_pin_settings():
    """Get all pin-related settings for a room"""
    room_name = request.args.get('room_name')
    
    if not room_name:
        return jsonify({"error": "Room name is required"}), 400
    
    try:
        # Get pin price from Redis
        pin_price_key = f"room_pin_price{redis_version}"
        pin_price = get_hash(pin_price_key, room_name)
        
        # If no price is set, use default
        if not pin_price:
            pin_price = DEFAULT_PIN_PRICE
        else:
            pin_price = int(pin_price)
        
        # Get room host
        room_host = get_hash(f"room_hosts{redis_version}", room_name)
        
        return jsonify({
            "pin_price": pin_price,
            "host": room_host
        })
    except Exception as e:
        logger.error(f"Error getting room pin settings: {str(e)}")
        return jsonify({"error": "Failed to get room pin settings"}), 500
