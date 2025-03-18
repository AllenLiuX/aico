from flask import send_file, request
from PIL import Image
import io
import hashlib

def init_placeholder_routes(app):
    @app.route('/api/placeholder/<int:width>/<int:height>')
    def generate_placeholder(width, height):
        # Limit dimensions to prevent abuse
        width = min(max(width, 16), 512)
        height = min(max(height, 16), 512)
        
        # Generate ETag based on dimensions
        etag = hashlib.md5(f"{width}x{height}".encode()).hexdigest()
        
        # Check if client has current version
        if request.if_none_match and etag in request.if_none_match:
            return '', 304
        
        # Create a new image with a light gray background
        image = Image.new('RGB', (width, height), color='#E5E7EB')
        
        # Convert to bytes
        img_io = io.BytesIO()
        image.save(img_io, 'PNG')
        img_io.seek(0)
        
        response = send_file(
            img_io,
            mimetype='image/png',
            as_attachment=False,
            download_name=f'placeholder_{width}x{height}.png'
        )
        
        # Add cache headers
        response.headers['Cache-Control'] = 'public, max-age=31536000, immutable'
        response.headers['ETag'] = etag
        response.headers['Vary'] = 'Accept-Encoding'
        return response
