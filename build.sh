#!/bin/bash

source ~/.bash_profile

python3 --version

pip3 install --upgrade pip

python3 -m venv venv 
. venv/bin/activate

# pipreqs --force
pip3 install -r backend/requirements.txt


# Navigate to the project directory
cd frontend/react_dj || exit

# Run npm start
# nohup npm start &
# Test
nohup npm start -- --disable-host-check &

# BUID
npm run build
sudo npm install -g serve
# sudo serve -s build
nohup sudo serve -s build -l 80 &

cd ../../backend || exit
nohup python3 app.py &

# sudo lsof -i :5000
# kill -9 <PID>