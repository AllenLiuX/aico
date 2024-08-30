#!/bin/bash

source ~/.bash_profile
python3 --version
# python3 -m venv venv 
# . venv/bin/activate

# Navigate to the project directory
cd frontend/react_dj || exit

# Run npm start
nohup npm start &

cd ../../backend || exit
nohup python3 app.py &