# Configuring SSL for the React Project

To configure SSL for the React project from scratch, follow these steps:

## Step 1: Stop Nginx Temporarily

Before running Certbot, stop Nginx to prevent conflicts:

```bash
sudo systemctl stop nginx
```

## Step 2: Manually Generate a Certificate

Run the following command to generate SSL certificates without configuring Nginx:

```bash
sudo certbot certonly --standalone -d aico-music.com -d www.aico-music.com
```

This will only generate the certificate, without trying to configure Nginx.
If successful, the certificates will be stored in:
```
/etc/letsencrypt/live/aico-music.com/fullchain.pem
/etc/letsencrypt/live/aico-music.com/privkey.pem
```

## Step 3: Manually Configure Nginx to Use the SSL Certificate

Once Certbot has successfully generated the certificate, update your Nginx configuration:

```bash
sudo nano /etc/nginx/nginx.conf
```

Update the server block to use the SSL certificate:

```nginx
# Main Nginx Configuration
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log notice;
pid /run/nginx.pid;

# Load dynamic modules
include /usr/share/nginx/modules/*.conf;

events {
    worker_connections 1024;
}

http {
    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile            on;
    tcp_nopush          on;
    keepalive_timeout   65;
    types_hash_max_size 4096;

    include             /etc/nginx/mime.types;
    default_type        application/octet-stream;

    # Redirect all HTTP traffic to HTTPS
    server {
        listen 80;
        listen [::]:80;
        server_name aico-music.com www.aico-music.com;
        
        return 301 https://$host$request_uri;
    }

    # HTTPS Configuration
    server {
        listen 443 ssl;
        listen [::]:443 ssl;
        server_name aico-music.com www.aico-music.com;

        ssl_certificate /etc/letsencrypt/live/aico-music.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/aico-music.com/privkey.pem;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Serve React static files
        root /usr/share/nginx/html/aico;
        index index.html;
        
        # Ensure React handles front-end routes
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Route API calls to backend
        location /api/ {
            proxy_pass http://127.0.0.1:5000/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_read_timeout 90;
            proxy_connect_timeout 90;
            proxy_buffering off;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # WebSocket support for Socket.IO
        location /socket.io/ {
            proxy_pass http://127.0.0.1:5000/socket.io/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_read_timeout 86400;
        }

        # Custom error pages (optional)
        error_page 404 /index.html;

        # HSTS for enhanced security (forces HTTPS)
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # Enable OCSP stapling (improves SSL performance)
        ssl_stapling on;
        ssl_stapling_verify on;
        resolver 8.8.8.8 8.8.4.4 valid=300s;
        resolver_timeout 5s;
    }
}
```

## Step 4: Restart Nginx

```bash
sudo systemctl restart nginx
sudo systemctl status nginx
```

## Step 5: Update Frontend Configuration

Update the `config.js` file in your React project to use HTTPS:

```javascript
// API configuration
export const host_by_https = true;
export const API_URL = host_by_https 
  ? "https://aico-music.com" 
  : "http://3.101.133.162:5000";
export const FRONTEND_URL = host_by_https 
  ? "https://aico-music.com" 
  : "http://aico-music.com";
```

## Step 6: Build and Deploy the React Application

```bash
cd /home/ec2-user/aico/frontend/react_dj
npm run build
sudo cp -r build/* /usr/share/nginx/html/aico/
```

## Handling YouTube Embedding Restrictions

Some YouTube videos have embedding restrictions set by their owners, which prevents them from being played in embedded players like the one used in our application. When this happens, you'll see an error message like "Video cannot be played in embedded players" (error code 101 or 150).

### Solution Implemented

1. **Error Handling**: We've improved the error handling in the YouTube player hook to detect embedding restriction errors and provide a better user experience:
   - The application now shows a clear error message to users
   - For hosts, the player automatically attempts to play the next track after a short delay
   - The code checks for alternative video sources when available

2. **Visual Feedback**: A prominent error banner appears when a video cannot be embedded, explaining the issue to users.

3. **Workarounds for Users**:
   - Try using different YouTube videos that allow embedding
   - Use YouTube Music links instead of regular YouTube links when possible
   - Consider using official music videos from artist channels, which often allow embedding

### Technical Details

The embedding restriction is controlled by the video owner on YouTube and cannot be bypassed. This is a YouTube API limitation, not an issue with our application's configuration.

The error codes related to embedding restrictions are:
- 101: "Video cannot be played in embedded players"
- 150: "Video cannot be played in embedded players"

## SSL Certificate Renewal

Let's Encrypt SSL certificates are valid for 90 days. You'll need to renew your certificate before it expires. Here's how to renew your SSL certificate:

### Step 1: Check Certificate Status

Check the status of your current certificate to see if it needs renewal:

```bash
sudo certbot certificates
```

This will show you the expiration date of your certificate and whether it's still valid.

### Step 2: Stop Nginx Temporarily

Before running Certbot for renewal, stop Nginx to free up port 80/443:

```bash
sudo systemctl stop nginx
```

### Step 3: Renew the Certificate

Run the following command to renew your SSL certificate:

```bash
sudo certbot renew
```

This command will automatically identify and renew any certificates that are due for renewal.

### Step 4: Start Nginx Again

After the renewal is complete, start Nginx again:

```bash
sudo systemctl start nginx
```

### Step 5: Verify Nginx Status

Verify that Nginx is running properly with the renewed certificate:

```bash
sudo systemctl status nginx
```

### Automating Renewal (Optional)

Certbot typically installs a cron job or systemd timer that automatically renews certificates before they expire. You can check if this is set up by running:

```bash
sudo systemctl list-timers | grep certbot
```

If you want to set up automatic renewal manually, you can add a cron job:

```bash
sudo crontab -e
```

Add the following line to run the renewal check twice daily (recommended by Let's Encrypt):

```
0 0,12 * * * certbot renew --quiet --deploy-hook "systemctl restart nginx"
```

This will attempt renewal twice a day and restart Nginx only when certificates are actually renewed.

These errors occur when the video owner has specifically disabled the "Allow embedding" option in their YouTube video settings.

## Troubleshooting YouTube Player Issues

### Error: "Failed to initialize player: window.YT.Player is not a constructor"

This error occurs when the YouTube Iframe API fails to load properly before the player tries to initialize. We've implemented several fixes to address this issue:

1. **Improved API Loading**: The YouTube API loading process now includes:
   - Better error handling for script loading failures
   - A polling mechanism to check when the API is available
   - Timeout detection to prevent infinite waiting
   - Detailed console logging for debugging

2. **Browser Compatibility**: Some browsers may have issues with the YouTube player:
   - Safari on iOS has better compatibility with YouTube embeds
   - Chrome on macOS may require additional permissions or settings
   - Make sure third-party cookies are enabled in your browser
   - Check that JavaScript is enabled and not blocked by extensions

3. **Network Issues**: YouTube API loading can be affected by:
   - Slow internet connections
   - Firewalls or content blockers
   - VPNs that might interfere with YouTube content

### Fixing Player Issues

If users experience YouTube player issues:

1. **Refresh the page**: This often resolves temporary loading issues
2. **Clear browser cache**: Cached scripts might be causing conflicts
3. **Try a different browser**: If the issue persists in one browser
4. **Check console logs**: Look for specific error messages to diagnose the problem

The application now includes more robust error handling and will display user-friendly error messages when issues occur.

## Certificate Renewal

Let's Encrypt certificates are valid for 90 days. To set up automatic renewal:

```bash
sudo certbot renew --dry-run
```

Add a cron job to automatically renew the certificate:

```bash
sudo crontab -e
```

Add the following line to run the renewal check twice a day:

```
0 0,12 * * * certbot renew --quiet --pre-hook "systemctl stop nginx" --post-hook "systemctl start nginx"
```

## Troubleshooting

If you encounter issues with Certbot, try these steps:

1. **Check Certbot logs**:
   ```bash
   sudo certbot --logs
   ```

2. **Verify domain ownership**:
   Ensure your domain's DNS records point to your server's IP address.

3. **Check port availability**:
   Make sure ports 80 and 443 are open and not blocked by a firewall.

4. **Manual verification**:
   If automatic verification fails, try the manual DNS challenge method:
   ```bash
   sudo certbot certonly --manual --preferred-challenges dns -d aico-music.com -d www.aico-music.com
   ```
   
5. **Check certificate validity**:
   ```bash
   sudo certbot certificates
   ```
