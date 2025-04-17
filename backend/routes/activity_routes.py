from flask import Blueprint, request, jsonify, send_file
import os
import json
import logging
import zipfile
from io import BytesIO
import csv
import util.redis_api as redis_api
from util import user_logging
import sys

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Blueprint
activity_routes = Blueprint('activity_routes', __name__)

redis_version = '_v1'

# Import the admin users list from app.py
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from app import ADMIN_USERS
except ImportError:
    # Fallback if import fails
    ADMIN_USERS = ['vincentliux', 'Carter']

# Helper function to verify admin access
def verify_admin_access():
    """Verify if the current user has admin access"""
    # Get auth token from request
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None, (jsonify({"error": "No token provided"}), 401)
    
    # Extract token from Authorization header (handle Bearer token format)
    auth_token = auth_header
    if auth_header.startswith('Bearer '):
        auth_token = auth_header[7:]  # Remove 'Bearer ' prefix
        logger.info(f"Admin API: Extracted token from Bearer format: {auth_token[:10]}...")
    
    # Get username from session
    # redis_version = os.environ.get('REDIS_VERSION', '')
    username = redis_api.get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        logger.warning(f"Admin API: Invalid or expired token: {auth_token[:10]}...")
        return None, (jsonify({"error": "Invalid or expired token"}), 401)
    
    # Check if user is admin
    user_data = redis_api.get_user_data(username)
    if not user_data.get('is_admin', False) and username not in ADMIN_USERS:
        logger.warning(f"Admin API: Unauthorized access attempt by {username}")
        return None, (jsonify({"error": "Unauthorized access"}), 403)
    
    logger.info(f"Admin API: Authorized access for admin user {username}")
    return username, None

# API endpoints for user activity data export
@activity_routes.route('/export/song-interactions', methods=['GET'])
def export_song_interactions():
    """API endpoint to export user-song interactions for recommendation systems"""
    try:
        username, error = verify_admin_access()
        if error:
            return error
            
        # Get song interactions
        interactions = user_logging.export_user_song_interactions()
        
        return jsonify({
            "success": True,
            "data": interactions,
            "count": len(interactions)
        })
    except Exception as e:
        logger.error(f"Error exporting song interactions: {str(e)}")
        return jsonify({"error": str(e)}), 500

@activity_routes.route('/export/room-interactions', methods=['GET'])
def export_room_interactions():
    """API endpoint to export user-room interactions for recommendation systems"""
    try:
        username, error = verify_admin_access()
        if error:
            return error
            
        # Get room interactions
        interactions = user_logging.export_user_room_interactions()
        
        return jsonify({
            "success": True,
            "data": interactions,
            "count": len(interactions)
        })
    except Exception as e:
        logger.error(f"Error exporting room interactions: {str(e)}")
        return jsonify({"error": str(e)}), 500

@activity_routes.route('/export/song-features', methods=['GET'])
def export_song_features():
    """API endpoint to export song features for recommendation systems"""
    try:
        username, error = verify_admin_access()
        if error:
            return error
            
        # Get song features
        features = user_logging.export_song_features()
        
        return jsonify({
            "success": True,
            "data": features,
            "count": len(features)
        })
    except Exception as e:
        logger.error(f"Error exporting song features: {str(e)}")
        return jsonify({"error": str(e)}), 500

@activity_routes.route('/export/room-features', methods=['GET'])
def export_room_features():
    """API endpoint to export room features for recommendation systems"""
    try:
        username, error = verify_admin_access()
        if error:
            return error
            
        # Get room features
        features = user_logging.export_room_features()
        
        return jsonify({
            "success": True,
            "data": features,
            "count": len(features)
        })
    except Exception as e:
        logger.error(f"Error exporting room features: {str(e)}")
        return jsonify({"error": str(e)}), 500

@activity_routes.route('/export/dataset', methods=['GET'])
def export_recommendation_dataset():
    """API endpoint to export complete recommendation dataset"""
    try:
        username, error = verify_admin_access()
        if error:
            return error
            
        # Get format parameter (json or csv)
        format_type = request.args.get('format', 'json')
        
        if format_type == 'json':
            # Get all datasets
            song_interactions = user_logging.export_user_song_interactions()
            room_interactions = user_logging.export_user_room_interactions()
            song_features = user_logging.export_song_features()
            room_features = user_logging.export_room_features()
            
            # Create dataset
            dataset = {
                "song_interactions": song_interactions,
                "room_interactions": room_interactions,
                "song_features": song_features,
                "room_features": room_features
            }
            
            return jsonify({
                "success": True,
                "data": dataset
            })
        
        elif format_type == 'csv':
            # Create in-memory zip file
            memory_file = BytesIO()
            with zipfile.ZipFile(memory_file, 'w') as zf:
                # Add song interactions CSV
                song_interactions = user_logging.export_user_song_interactions()
                if song_interactions:
                    si_file = BytesIO()
                    si_writer = csv.DictWriter(si_file, fieldnames=song_interactions[0].keys())
                    si_writer.writeheader()
                    si_writer.writerows(song_interactions)
                    zf.writestr('song_interactions.csv', si_file.getvalue())
                
                # Add room interactions CSV
                room_interactions = user_logging.export_user_room_interactions()
                if room_interactions:
                    ri_file = BytesIO()
                    ri_writer = csv.DictWriter(ri_file, fieldnames=room_interactions[0].keys())
                    ri_writer.writeheader()
                    ri_writer.writerows(room_interactions)
                    zf.writestr('room_interactions.csv', ri_file.getvalue())
                
                # Add song features CSV
                song_features = user_logging.export_song_features()
                if song_features:
                    sf_file = BytesIO()
                    sf_writer = csv.DictWriter(sf_file, fieldnames=song_features[0].keys())
                    sf_writer.writeheader()
                    sf_writer.writerows(song_features)
                    zf.writestr('song_features.csv', sf_file.getvalue())
                
                # Add room features CSV
                room_features = user_logging.export_room_features()
                if room_features:
                    rf_file = BytesIO()
                    rf_writer = csv.DictWriter(rf_file, fieldnames=room_features[0].keys())
                    rf_writer.writeheader()
                    rf_writer.writerows(room_features)
                    zf.writestr('room_features.csv', rf_file.getvalue())
            
            # Reset file pointer
            memory_file.seek(0)
            
            return send_file(
                memory_file,
                mimetype='application/zip',
                as_attachment=True,
                download_name='recommendation_dataset.zip'
            )
        
        else:
            return jsonify({"error": "Invalid format. Use 'json' or 'csv'"}), 400
            
    except Exception as e:
        logger.error(f"Error exporting recommendation dataset: {str(e)}")
        return jsonify({"error": str(e)}), 500

@activity_routes.route('/export/user-analytics', methods=['GET'])
def export_user_analytics():
    """API endpoint to export user analytics data for admin dashboard"""
    try:
        username, error = verify_admin_access()
        if error:
            return error
            
        # Get all usernames from user_profiles
        all_users = []
        user_keys = redis_api.redis_client.hkeys(f"user_profiles{redis_version}")
        
        logger.info(f"Found {len(user_keys)} user profiles")
        
        for user_key in user_keys:
            try:
                username_str = user_key.decode('utf-8') if isinstance(user_key, bytes) else user_key
                logger.info(f"Processing user: {username_str}")
                
                # Get user profile data
                profile_json = redis_api.get_hash(f"user_profiles{redis_version}", username_str)
                if not profile_json:
                    logger.warning(f"No profile found for user {username_str}")
                    continue
                
                try:
                    # Try to parse the profile JSON
                    if isinstance(profile_json, bytes):
                        profile_json = profile_json.decode('utf-8')
                    
                    profile = json.loads(profile_json)
                    logger.info(f"Successfully parsed profile for {username_str}")
                except json.JSONDecodeError as e:
                    logger.error(f"Error parsing profile JSON for {username_str}: {str(e)}")
                    continue
                
                # Get user avatar
                avatar_url = profile.get('avatar', '')
                if not avatar_url and profile.get('google_picture'):
                    avatar_url = profile.get('google_picture')
                elif not avatar_url:
                    avatar_url = f"/api/avatar/{username_str}"
                
                # Get user coin balance
                try:
                    coins = get_user_coins(username_str)
                    logger.info(f"User {username_str} has {coins} coins")
                except Exception as e:
                    logger.error(f"Error getting coins for user {username_str}: {str(e)}")
                    coins = 0
                
                # Get user stats
                created_rooms = profile.get('created_rooms', [])
                
                # Get favorites count
                try:
                    favorites_json = redis_api.get_hash(f"user_favorites{redis_version}", username_str)
                    favorites = json.loads(favorites_json) if favorites_json else []
                except Exception as e:
                    logger.error(f"Error getting favorites for {username_str}: {str(e)}")
                    favorites = []
                
                # Get play count from logs
                play_count = 0
                favorite_count = 0
                
                # Get user logs
                try:
                    user_logs = user_logging.get_user_logs(username_str, limit=1000)
                    
                    # Count plays and favorites
                    for log in user_logs:
                        if log.get('action') == 'play_song':
                            play_count += 1
                        elif log.get('action') == 'favorite_song':
                            favorite_count += 1
                    
                    logger.info(f"User {username_str} has {play_count} plays and {favorite_count} favorites")
                except Exception as e:
                    logger.error(f"Error getting logs for {username_str}: {str(e)}")
                
                # Create user analytics object
                user_data = {
                    "username": username_str,
                    "avatar": avatar_url,
                    "coins": coins,
                    "rooms_count": len(created_rooms),
                    "rooms": created_rooms,
                    "favorites_count": len(favorites),
                    "play_count": play_count,
                    "favorite_count": favorite_count,
                    "join_date": profile.get('created_at', ''),
                    "last_login": profile.get('last_login', ''),
                    "is_admin": username_str in ADMIN_USERS or profile.get('is_admin', False),
                    "email": profile.get('email', ''),
                    "google_user": profile.get('google_user', False)
                }
                
                all_users.append(user_data)
                logger.info(f"Successfully added user {username_str} to analytics")
            except Exception as e:
                logger.error(f"Error processing user {user_key}: {str(e)}")
                continue
        
        # Sort users by join date (newest first)
        all_users.sort(key=lambda x: x.get('join_date', ''), reverse=True)
        
        logger.info(f"Returning {len(all_users)} users in analytics data")
        
        return jsonify({
            "success": True,
            "data": all_users,
            "count": len(all_users)
        })
    except Exception as e:
        logger.error(f"Error exporting user analytics: {str(e)}")
        return jsonify({"error": str(e)}), 500

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
        user_data = redis_api.get_user_data(username)
        
        # If coins exists in user_data, return that value
        if 'coins' in user_data:
            return int(user_data.get('coins', 0))
        
        # Fallback to user_profiles if not in user_data
        profile_json = redis_api.get_hash(f"user_profiles{redis_version}", username)
        if profile_json:
            profile = json.loads(profile_json) if isinstance(profile_json, str) else json.loads(profile_json.decode('utf-8'))
            coins = profile.get('coins', 0)
            
            # Sync to user_data for future requests
            user_data['coins'] = coins
            redis_api.set_user_data(username, user_data)
            
            return int(coins)
        
        # Default to 0 if no coins found
        return 0
    except Exception as e:
        logger.error(f"Error getting coins for user {username}: {str(e)}")
        return 0

@activity_routes.route('/auth/user', methods=['GET'])
def get_current_user():
    """Get current user data"""
    try:
        # Get auth token from request
        auth_token = request.headers.get('Authorization')
        if not auth_token:
            return jsonify({"error": "No token provided"}), 401
        
        # Get username from session
        # redis_version = os.environ.get('REDIS_VERSION', '')
        username = redis_api.get_hash(f"sessions{redis_version}", auth_token)
        if not username:
            return jsonify({"error": "Invalid or expired token"}), 401
        
        # Get user data
        user_data = redis_api.get_user_data(username)

        logger.info(f"User data: {user_data}")
        
        return jsonify({
            "success": True,
            "user": {
                "username": username,
                "is_admin": user_data.get('is_admin', False) or username in ADMIN_USERS
            }
        })
    except Exception as e:
        logger.error(f"Error getting current user: {str(e)}")
        return jsonify({"error": str(e)}), 500
