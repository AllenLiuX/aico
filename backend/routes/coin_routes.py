import logging
import json
from datetime import datetime
from flask import Blueprint, request, jsonify
from util.redis_api import get_hash, write_hash, redis_version
from util.coin_manager import get_user_coins, add_user_coins, use_user_coins

# Set up logging
logger = logging.getLogger(__name__)

# Constants
DEFAULT_PIN_PRICE = 10  # Default price for pinning tracks (in coins)
DEFAULT_REQUEST_PRICE = 30  # Default price for requesting tracks (in coins)

# Create blueprint
coin_routes = Blueprint('coin_routes', __name__)


@coin_routes.route('/get-pin-price', methods=['GET'])
def get_pin_price():
    """Get the pin price for a specific room"""
    room_name = request.args.get('room_name')
    if not room_name:
        return jsonify({"error": "Missing room_name parameter"}), 400
    
    try:
        # Get pin price from Redis
        pin_price_key = f"room_pin_price{redis_version}"
        price = get_hash(pin_price_key, room_name)
        
        # Default price if not set
        if not price:
            price = "10"  # Default to 10 coins
            
            # Set default price in Redis
            write_hash(pin_price_key, room_name, price)
        
        # Get room host
        room_host_data = get_hash(f"room_hosts{redis_version}", room_name)
        host_username = None
        host_avatar = None
        
        # Parse host data - could be a string username or a JSON object
        if room_host_data:
            try:
                # Try to parse as JSON
                host_data = json.loads(room_host_data)
                if isinstance(host_data, dict) and 'username' in host_data:
                    host_username = host_data['username']
                    host_avatar = host_data.get('avatar', '/images/default_avatar.png')
                else:
                    host_username = room_host_data
            except json.JSONDecodeError:
                # If not JSON, assume it's just the username
                host_username = room_host_data
        
        # Get auth token to check if user is the host
        auth_header = request.headers.get('Authorization')
        is_host = False
        
        if auth_header:
            auth_token = auth_header
            if auth_header.startswith('Bearer '):
                auth_token = auth_header[7:]  # Remove 'Bearer ' prefix
                
            username = get_hash(f"sessions{redis_version}", auth_token)
            if username and host_username == username:
                is_host = True
        
        return jsonify({
            "price": int(price),
            "host": host_username,
            "host_avatar": host_avatar,
            "is_host": is_host
        })
    except Exception as e:
        logger.error(f"Error getting pin price: {str(e)}")
        return jsonify({"error": f"Failed to get pin price: {str(e)}"}), 500

@coin_routes.route('/set-pin-price', methods=['POST'])
def set_pin_price():
    """Set the pin price for a specific room (host only)"""
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({"error": "Authentication required"}), 401

    # Extract token from Authorization header
    auth_token = None
    if auth_header.startswith('Bearer '):
        auth_token = auth_header[7:]  # Remove 'Bearer ' prefix
    else:
        auth_token = auth_header

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
        
        # Check if room exists in playlist
        playlist_data = get_hash(f"room_playlists{redis_version}", room_name)
        if not playlist_data:
            return jsonify({"error": "Room not found"}), 404
        
        # Check if user is the host of the room
        room_host_data = get_hash(f"room_hosts{redis_version}", room_name)
        host_username = None
        
        # Parse host data - could be a string username or a JSON object
        if room_host_data:
            try:
                # Try to parse as JSON
                host_data = json.loads(room_host_data)
                if isinstance(host_data, dict) and 'username' in host_data:
                    host_username = host_data['username']
                else:
                    host_username = room_host_data
            except json.JSONDecodeError:
                # If not JSON, assume it's just the username
                host_username = room_host_data
        
        # If no host is set, set the current user as the host
        if not host_username:
            # Get user's avatar URL
            user_data = get_hash(f"user_profiles{redis_version}", username)
            avatar = None
            if user_data:
                try:
                    user_profile = json.loads(user_data)
                    avatar = user_profile.get('avatar_url')
                except:
                    pass
            
            # Set the current user as the host
            host_data = {
                "username": username,
                "avatar": avatar or "/images/default_avatar.png",
                "created_at": datetime.now().isoformat()
            }
            write_hash(f"room_hosts{redis_version}", room_name, json.dumps(host_data))
            
            # Add host info to room metadata
            room_metadata_key = f"room_metadata{redis_version}"
            room_metadata = get_hash(room_metadata_key, room_name)
            
            if room_metadata:
                try:
                    metadata = json.loads(room_metadata)
                    metadata['host'] = username
                    metadata['host_avatar'] = avatar
                    write_hash(room_metadata_key, room_name, json.dumps(metadata))
                except:
                    pass
            
            logger.info(f"Set {username} as host for room {room_name}")
            host_username = username
        
        # Check if user is the host
        if host_username != username:
            return jsonify({"error": "Only the room host can set the pin price"}), 403
        
        # Set pin price in Redis
        pin_price_key = f"room_pin_price{redis_version}"
        write_hash(pin_price_key, room_name, str(price))
        
        logger.info(f"Pin price for room {room_name} set to {price} coins by {username}")
        return jsonify({"success": True, "price": price})
    except Exception as e:
        logger.error(f"Error setting pin price: {str(e)}")
        return jsonify({"error": f"Failed to set pin price: {str(e)}"}), 500

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
        room_host_data = get_hash(f"room_hosts{redis_version}", room_name)
        host_username = None
        host_avatar = None
        
        # Parse host data - could be a string username or a JSON object
        if room_host_data:
            try:
                # Try to parse as JSON
                host_data = json.loads(room_host_data)
                if isinstance(host_data, dict) and 'username' in host_data:
                    host_username = host_data['username']
                    host_avatar = host_data.get('avatar', '/images/default_avatar.png')
                else:
                    host_username = room_host_data
            except json.JSONDecodeError:
                # If not JSON, assume it's just the username
                host_username = room_host_data
        
        # Check if user is the host
        auth_header = request.headers.get('Authorization')
        is_host = False
        
        if auth_header and host_username:
            auth_token = auth_header
            if auth_header.startswith('Bearer '):
                auth_token = auth_header[7:]  # Remove 'Bearer ' prefix
                
            username = get_hash(f"sessions{redis_version}", auth_token)
            if username and host_username == username:
                is_host = True
        
        return jsonify({
            "pin_price": pin_price,
            "host": host_username,
            "host_avatar": host_avatar,
            "is_host": is_host
        })
    except Exception as e:
        logger.error(f"Error getting room pin settings: {str(e)}")
        return jsonify({"error": f"Failed to get room pin settings: {str(e)}"}), 500

# ---------------------------------------------------------------------------
# Request Price Endpoints (similar to pin price)
# ---------------------------------------------------------------------------

@coin_routes.route('/get-request-price', methods=['GET'])
def get_request_price():
    """Get the request price for a specific room"""
    room_name = request.args.get('room_name')
    if not room_name:
        return jsonify({"error": "Missing room_name parameter"}), 400

    try:
        price_key = f"room_request_price{redis_version}"
        price = get_hash(price_key, room_name)
        if not price:
            price = str(DEFAULT_REQUEST_PRICE)
            write_hash(price_key, room_name, price)

        # Get host information (reuse logic from get_pin_price)
        host_data_raw = get_hash(f"room_hosts{redis_version}", room_name)
        host_username = None
        host_avatar = None
        if host_data_raw:
            try:
                host_data = json.loads(host_data_raw)
                host_username = host_data.get('username')
                host_avatar = host_data.get('avatar', '/images/default_avatar.png')
            except json.JSONDecodeError:
                host_username = host_data_raw

        # Determine if current caller is host
        auth_header = request.headers.get('Authorization')
        is_host = False
        if auth_header and host_username:
            token = auth_header[7:] if auth_header.startswith('Bearer ') else auth_header
            caller_username = get_hash(f"sessions{redis_version}", token)
            if caller_username and caller_username == host_username:
                is_host = True

        return jsonify({
            "price": int(price),
            "host": host_username,
            "host_avatar": host_avatar,
            "is_host": is_host
        })
    except Exception as e:
        logger.error(f"Error getting request price: {str(e)}")
        return jsonify({"error": f"Failed to get request price: {str(e)}"}), 500

@coin_routes.route('/set-request-price', methods=['POST'])
def set_request_price():
    """Set the request price for a room (host only)"""
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({"error": "Authentication required"}), 401

    token = auth_header[7:] if auth_header.startswith('Bearer ') else auth_header
    username = get_hash(f"sessions{redis_version}", token)
    if not username:
        return jsonify({"error": "Invalid session"}), 401

    try:
        data = request.json or {}
        room_name = data.get('room_name')
        price = data.get('price')
        if not all([room_name, price]):
            return jsonify({"error": "Missing required parameters"}), 400

        try:
            price = int(price)
            if price < 1:
                return jsonify({"error": "Price must be at least 1 coin"}), 400
        except ValueError:
            return jsonify({"error": "Price must be a valid number"}), 400

        # Fetch host
        host_data_raw = get_hash(f"room_hosts{redis_version}", room_name)
        host_username = None
        if host_data_raw:
            try:
                host_data = json.loads(host_data_raw)
                host_username = host_data.get('username')
            except json.JSONDecodeError:
                host_username = host_data_raw
        if host_username != username:
            return jsonify({"error": "Only the room host can set the request price"}), 403

        # Write to Redis
        price_key = f"room_request_price{redis_version}"
        write_hash(price_key, room_name, str(price))
        logger.info(f"Request price for room {room_name} set to {price} coins by {username}")
        return jsonify({"success": True, "price": price})
    except Exception as e:
        logger.error(f"Error setting request price: {str(e)}")
        return jsonify({"error": f"Failed to set request price: {str(e)}"}), 500
