#!/bin/bash

# AICO Music Frontend Deployment Script
# This script builds and deploys the React frontend to the Nginx server

# Display banner
echo "========================================"
echo "  AICO Music Frontend Deployment Tool"
echo "========================================"
echo ""

# Set variables
FRONTEND_DIR="/home/ec2-user/aico/frontend/react_dj"
BUILD_DIR="$FRONTEND_DIR/build"
NGINX_DIR="/usr/share/nginx/html"

# Function to check if command succeeded
check_status() {
  if [ $? -eq 0 ]; then
    echo "✅ $1 completed successfully"
  else
    echo "❌ $1 failed"
    exit 1
  fi
}

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
  echo "⚠️  This script requires sudo privileges to deploy to Nginx"
  echo "Please run with: sudo $0"
  exit 1
fi

# Step 1: Navigate to frontend directory
echo "📁 Changing to frontend directory..."
cd "$FRONTEND_DIR"
check_status "Directory change"

# Step 2: Install dependencies if needed
if [ "$1" == "--install-deps" ]; then
  echo "📦 Installing dependencies..."
  npm install
  check_status "Dependency installation"
fi

# Step 3: Build the React application
echo "🔨 Building React application..."
npm run build
check_status "React build"

# Step 4: Deploy to Nginx
echo "🚀 Deploying to Nginx..."
cp -r "$BUILD_DIR"/* "$NGINX_DIR"/
check_status "Deployment to Nginx"

# Step 5: Restart Nginx if requested
if [ "$1" == "--restart-nginx" ] || [ "$2" == "--restart-nginx" ]; then
  echo "🔄 Restarting Nginx..."
  systemctl restart nginx
  check_status "Nginx restart"
fi

# Step 6: Restart backend if requested
if [ "$1" == "--restart-backend" ] || [ "$2" == "--restart-backend" ]; then
  echo "🔄 Restarting backend server..."
  cd /home/ec2-user/aico/backend
  pkill -f "python.*app.py"
  source venv/bin/activate
  python app.py > /dev/null 2>&1 &
  check_status "Backend restart"
fi

echo ""
echo "✨ Frontend deployment completed successfully!"
echo "Visit https://aico-music.com to see your changes"
echo ""
echo "Usage options:"
echo "  --install-deps     : Install npm dependencies before building"
echo "  --restart-nginx    : Restart Nginx after deployment"
echo "  --restart-backend  : Restart the backend server"
echo ""
