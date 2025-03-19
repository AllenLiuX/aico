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
