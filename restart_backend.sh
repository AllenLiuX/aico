#!/bin/bash

# Kill the existing backend process
pkill -f "/home/ec2-user/aico/backend/venv/bin/python3 /home/ec2-user/aico/backend/app.py"

# Wait a moment for the process to terminate
sleep 2

# Change to the backend directory
cd /home/ec2-user/aico/backend

# Start the backend in a new screen session
screen -S backend -d -m python3 app.py

echo "Backend restarted successfully!"
