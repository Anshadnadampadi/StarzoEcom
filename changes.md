# StarzoEcom AWS EC2 Deployment Documentation

## Project Stack

- Node.js
- Express.js
- EJS
- MongoDB Atlas
- Socket.IO
- Nginx
- PM2
- AWS EC2 Ubuntu Server

---

# 1. Created AWS EC2 Instance

Launched:
- Ubuntu Linux Server on AWS EC2

Configured:
- Security Group
- Public IPv4 Address
- SSH Access

---

# 2. Connected to Ubuntu Server

Used:
- EC2 Instance Connect (Browser Terminal)

Connected successfully to:

```bash
ubuntu@ip-172-31-xx-xx:~$
```

---

# 3. Cloned Project from GitHub

Executed:

```bash
git clone https://github.com/Anshadnadampadi/StarzoEcom.git
```

Entered project directory:

```bash
cd StarzoEcom
```

---

# 4. Installed Node.js Dependencies

Executed:

```bash
npm install
```

Installed all packages from:
- package.json

---

# 5. Fixed Linux Case-Sensitive Import Errors

Resolved issues like:

```bash
product.js ≠ Product.js
```

Updated:
- import paths
- filename consistency

Linux is case-sensitive unlike Windows.

---

# 6. Configured Environment Variables

Created:

```bash
.env
```

Added:
- MongoDB URI
- Session secret
- API keys
- Port variables

---

# 7. Connected MongoDB Atlas

Configured:
- Database Access
- Network Access

Allowed public access temporarily:

```bash
0.0.0.0/0
```

MongoDB connected successfully.

---

# 8. Started Node.js Server

Executed:

```bash
npm start
```

Server running on:

```bash
http://localhost:7000
```

---

# 9. Configured EC2 Security Group

Opened inbound ports:

| Port | Purpose |
|------|----------|
| 22 | SSH |
| 80 | HTTP |
| 443 | HTTPS |
| 7000 | Node.js Testing |

---

# 10. Accessed Website Publicly

Website became accessible using:

```bash
http://PUBLIC_IP:7000
```

---

# 11. Installed PM2

Installed process manager:

```bash
sudo npm install -g pm2
```

Started app:

```bash
pm2 start server.js
```

Benefits:
- Background process
- Auto restart
- Crash recovery

---

# 12. Configured PM2 Startup

Executed:

```bash
pm2 save
pm2 startup
```

Ensured app survives server reboot.

---

# 13. Installed Nginx

Executed:

```bash
sudo apt install nginx -y
```

---

# 14. Configured Nginx Reverse Proxy

Created configuration:

```bash
sudo nano /etc/nginx/sites-available/myapp
```

Configured:

```nginx
server {
    listen 80;

    server_name _;

    location / {
        proxy_pass http://localhost:7000;

        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;

        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;

        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io/ {
        proxy_pass http://localhost:7000;

        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;

        proxy_set_header Connection "Upgrade";

        proxy_set_header Host $host;
    }

    location /video/ {
        alias /home/ubuntu/StarzoEcom/public/video/;
    }
}
```

---

# 15. Enabled Nginx Site

Executed:

```bash
sudo ln -s /etc/nginx/sites-available/myapp /etc/nginx/sites-enabled/
```

Removed default site:

```bash
sudo rm /etc/nginx/sites-enabled/default
```

---

# 16. Tested and Restarted Nginx

Executed:

```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

# 17. Website Accessible Without Port

Website became accessible using:

```bash
http://PUBLIC_IP
```

without `:7000`.

---

# 18. Configured Static File Serving

Verified Express static middleware:

```javascript
app.use(express.static(path.join(__dirname, "public")));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
```

---

# 19. Verified Video Files on EC2

Confirmed video files exist inside:

```bash
public/video/
```

Example files:
- iphone-hero.mp4
- pixel-hero.mp4
- google-first.mp4

---

# 20. Verified Tailwind CSS

Confirmed:

```bash
public/css/output.css
```

exists and loads correctly.

---

# 21. Diagnosed Frontend Runtime Issues

Investigated:
- JS loading
- video rendering
- SPA navigation
- Socket.IO connection

Used:
- Browser Console
- Network Tab
- Direct asset testing

---

# 22. Learned Important Concepts

## AWS
- EC2
- Security Groups
- Public IP

## Linux
- nano
- grep
- find
- mv
- ls

## Backend Deployment
- PM2
- Nginx
- Reverse Proxy
- Environment Variables

## MongoDB Atlas
- IP Whitelist
- Cloud Database Connectivity

## Frontend Debugging
- Browser Console
- Network Requests
- Static Assets
- Websocket Debugging

---

# Current Architecture

```text
Internet
   ↓
Nginx
   ↓
PM2
   ↓
Node.js + Express + EJS
   ↓
MongoDB Atlas
```

---

# Current Working Components

✅ AWS EC2 Server  
✅ Ubuntu Linux  
✅ Node.js Backend  
✅ MongoDB Atlas  
✅ PM2  
✅ Nginx Reverse Proxy  
✅ Static File Serving  
✅ Tailwind CSS  
✅ Public Website Access  

---

# Remaining Frontend Issue

Frontend runtime issue still affects:
- Video rendering
- SPA navigation
- Dynamic homepage behavior
- Shop page rendering

Backend deployment itself is successful.

---

# Useful Commands

## Restart PM2

```bash
pm2 restart all
```

## Check PM2 Logs

```bash
pm2 logs
```

## Restart Nginx

```bash
sudo systemctl restart nginx
```

## Check Nginx Status

```bash
sudo systemctl status nginx
```

## Test Nginx Config

```bash
sudo nginx -t
```

## Check Open Port

```bash
sudo lsof -i :7000
```

## Pull Latest Changes

```bash
git pull
npm install
pm2 restart all
```