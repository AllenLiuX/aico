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
    auth_token = request.headers.get('Authorization')
    if not auth_token:
        return None, (jsonify({"error": "No token provided"}), 401)
    
    # Get username from session
    # redis_version = os.environ.get('REDIS_VERSION', '')
    username = redis_api.get_hash(f"sessions{redis_version}", auth_token)
    if not username:
        return None, (jsonify({"error": "Invalid or expired token"}), 401)
    
    # Check if user is admin
    user_data = redis_api.get_user_data(username)
    if not user_data.get('is_admin', False) and username not in ADMIN_USERS:
        return None, (jsonify({"error": "Unauthorized access"}), 403)
    
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
