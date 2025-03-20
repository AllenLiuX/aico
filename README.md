## how to start

```./build.sh```

OR check the code in build.sh and run correspondingly.

## Installation

### NPM

```npm install```

On AWS Server:


### Redis

Mac:
```brew install redis```

```brew services start redis```

```brew services info redis```

```redis-cli```

```ping```

```brew services stop redis```

```redis-server```

<!-- setting at /usr/local/etc/redis.conf -->


## Online Serving

```screen -ls```  # list all screen sessions

```screen -S xxx``` # create a new screen session

```screen -r xxx``` # attach to an existing screen session

```ctrl -A -D``` # detach from a screen session

## Deploying Updates to the React Frontend

When you make changes to the React frontend, you can use our deployment script:

```bash
# Basic deployment
sudo ./deploy_frontend.sh

# Install dependencies and deploy
sudo ./deploy_frontend.sh --install-deps

# Deploy and restart Nginx
sudo ./deploy_frontend.sh --restart-nginx

# Deploy and restart backend
sudo ./deploy_frontend.sh --restart-backend
```

Alternatively, you can manually deploy by following these steps:

1. Update your code in the React project
2. Build the React application:
   ```bash
   cd /home/ec2-user/aico/frontend/react_dj
   npm run build
   ```
3. Copy the built files to the Nginx web server directory:
   ```bash
   sudo cp -r /home/ec2-user/aico/frontend/react_dj/build/* /usr/share/nginx/html/aico/
   ```
4. If you've made changes to the Nginx configuration, restart Nginx:
   ```bash
   sudo systemctl restart nginx
   ```

## HTTPS Configuration

The application is configured to use HTTPS for secure communication. The key components are:

1. **Nginx Configuration**: Located at `/etc/nginx/nginx.conf`, handles:
   - HTTPS certificates
   - Redirecting HTTP to HTTPS
   - Proxying API requests to the backend
   - WebSocket support for real-time features
   - Client-side routing support with the `try_files` directive

2. **Frontend Configuration**: In `frontend/react_dj/src/config.js`:
   - Set `host_by_https` to `true` to use HTTPS URLs
   - API endpoints are configured to use the HTTPS protocol

3. **Backend Configuration**: The Flask backend in `backend/app.py`:
   - Listens on port 5000
   - Accepts requests proxied through Nginx
   - Has CORS enabled to allow frontend requests

4. **Client-Side Routing**: The Nginx configuration includes support for React Router:
   ```nginx
   location / {
     try_files $uri $uri/ /index.html;
   }
   ```
   This ensures that any path that doesn't match a physical file will serve the index.html, allowing React Router to handle client-side routing. This is important for URLs like `/homepage` to work correctly.

If you need to modify the HTTPS configuration, make sure to update both the Nginx configuration and the frontend configuration files.

For detailed instructions on setting up SSL from scratch, please refer to the [SSL_README.md](./SSL_README.md) file.

### Change Log

- 2025-03-19
  - Added HTTPS support with Nginx configuration
  - Added iOS App setup
  - Fixed favorite room name and moderation UI bug in playroom
  - Added favorite buttons in playlist and created favorite room for users
  - Removed create_room page and directly go to playlist generator
  - Added examples in create room page and fixed created_at bug when uploading avatar
  - Added create_at timestamp for each room and made explore page sorted by time
  - Added playlist generator entrance in playroom with deduped new songs append to playlist
  - Added host and guest mode to profile page with shareable username URLs
  - Fixed lyrics scrolling and added Redis migration code
  - Fixed WebSocket support for real-time features
  - Added support for client-side routing with React Router

- 2025-03-18
  - Fixed About Us and landing page
  - Updated requirements.txt
  - Merged pull request #18 for sync-realtime feature
  - Added avatar upload functionality
  - Changed theme color and added request confirmation modal

- 2025-03-17
  - Synchronized guest's view of the player with the host's view

- 2025-03-16
  - Optimized About Us page
  - Added config.js for request URL configuration
  - Added Google login (SSL to be setup)

- 2025-03-14
  - Added pin to top backend sync
  - Fixed safe room name without "/"
  - Added web logo

- 2025-03-11
  - Fixed pending refresh issue
  - Changed "Listen" to "Preview"
  - Fixed moderation setting (switch still bug)
  - Fixed lyric jump issue
  - Added social functions, favorite in playroom and profile

- 2025-03-08
  - Fixed phone view of playroom
  - Fixed share room button
  - Added edit playroom description
  - Added pagination of playlist
  - Moved lyrics inside player

- 2025-03-07
  - Fixed phone view width of playroom
  - Added playroom moderation switch
  - Added song number selector in create room
  - Added go back button in search page
  - Added cache for getting lyrics
  - Launched realtime lyrics in playroom
  - Tested Wangyiyun user profile import (not working yet)

- 2025-03-06
  - Merged pull request #4 for approve-reject feature

- 2025-03-05
  - Added mobile responsive design

- 2025-03-04
  - Added functionality to approve/reject songs by hosts
  - Refactored playroom.js into separate components and hooks

- 2025-02-24
  - Merged pull request #2 for pin_to_top feature
  - Added pin to top button next to the delete button
  - Fixed issue where deleting a song not currently playing causes player restart
  - Added avatar upload entrance and backend API (not working yet)
  - Fixed explore page load more issue
  - Added explore page

- 2025-02-23
  - Added profile with bio and edit profile APIs
  - Stored host info when creating room and displayed on playroom
  - Launched profile page
  - Refactored backend files
  - Optimized songlist generation prompt
  - Merged pull request #1 for delete_function
  - Added user system for login and register with email
  - Fixed search go back functionality
  - Changed from GPT-4o-mini to GPT-4o
  - Improved playlist loading and cover image
  - Added avatar support
  - Fixed playroom UI and iPhone UI
  - Fixed song change bug
  - Added meta data
  - Reorganized CSS files
  - Initialized profile page

- 2025-02-22
  - Created component for deleting songs in a playlist
  - Unified song_info

- 2025-02-20
  - Debugged skip to second song in playlist error
  - Added progress bar
  - Added search by song name
  - Fixed playroom
  - Changed player UI
  - Fixed search add songs
  - Added support for YouTube Music and Redis utils

- 2024-12-21
  - Finished search page basic functions
  - Fixed URL for online serving

- 2024-11-10
  - Fixed glitching issue

- 2024-10-29
  - Added music WIP

- 2024-09-20
  - Added play first song feature
  - Added ID API and frontend testing
  - Added introduction and settings storage and frontend feature
  - Added QR code generation and frontend feature
  - Deployed online
  - Optimized prompt and output format of GPT

- 2024-09-14
  - Fixed GPT integration
  - Solved environment issues

- 2024-09-13
  - Fixed share button and link
  - Set up all host MVP pages
  - Set up basic Redis database

- 2024-09-12
  - Fixed README
  - Added frontend

- 2024-08-29
  - Project initialization
  - Basic main page for music list setup
