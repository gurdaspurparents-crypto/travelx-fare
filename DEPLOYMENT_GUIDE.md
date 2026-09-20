# 🚀 TravelX B2B Agent Portal - Cloud Deployment & Setup Guide

Is guide mein **TravelX Special Fare Manager & B2B Portal** ko live cloud server par host karne ke 3 sabse aasan aur reliable tarike diye gaye hain, jisse aapke **500+ B2B agents** apne mobile ya PC par direct live rates dekh sakein.

---

## 🔒 Security & Privacy Guarantee
Portal B2B agents ke liye **100% Secure & Sanitized** hai:
- ✅ **No Vendor Leak**: Vendor ka naam (`Travel Wings`, `FlyHigh`, etc.) aur Vendor ID kabhi public link par nahi dikhayi dega.
- ✅ **No Net Fare / Margin Leak**: Purchase cost (Net fare) aur aapka profit margin code aur API response se server-level par strip kar diya gaya hai.
- ✅ **Safe DevTools**: Agar koi smart agent browser inspect kare, tab bhi network payload mein sirf clean selling rate dikhega.
- ✅ **Customer Mode**: Agents apne walk-in client ke samne screen open karke apna custom markup (+₹500 / +₹1000) add karke dikha sakte hain.
- ✅ **Admin Lock**: Portal par internal Admin panel open karne ke liye Security PIN (`7860`) lagaya gaya hai.

---

## 🌐 Option 1: Render.com (Sabse Aasan & Fast Setup - 5 Minute Setup)

Render par Node.js web services deploy karna bahut aasan hai aur ye automatic HTTPS/SSL certificate deta hai.

### Steps:
1. **GitHub Repository Banayein**:
   - Apne code ko GitHub private repository mein push karein:
     ```bash
     git init
     git add .
     git commit -m "TravelX Special Fare Manager with B2B Portal"
     git branch -M main
     git remote add origin https://github.com/YOUR_USERNAME/travelx-fare-manager.git
     git push -u origin main
     ```
2. **Render Account**:
   - [Render.com](https://render.com) par free account banayein.
   - Click **"New +"** ➔ **"Web Service"**.
   - Apna GitHub repository connect karein.
3. **Settings Configure Karein**:
   - **Name**: `travelx-rates`
   - **Environment**: `Node`
   - **Build Command**:
     ```bash
     npm install && cd client && npm install && npm run build && cd ..
     ```
   - **Start Command**:
     ```bash
     node server/index.js
     ```
   - **Persistent Disk (Important for SQLite Database)**:
     - SQLite database (`server/database/travelx.db`) ko safe rakhne ke liye Render mein **"Disks"** tab par click karein:
       - Mount Path: `/opt/render/project/src/server/database`
       - Size: 1 GB (Kaafi hai)
4. **Custom Domain Add Karein (Optional)**:
   - Render settings mein jakar **Custom Domain** add karein: `rates.travelx.co.in`.
   - Apne DNS provider (GoDaddy/Cloudflare/Hostinger) mein CNAME record add karein:
     - `CNAME` | `rates` ➔ `travelx-rates.onrender.com`

---

## 🖥️ Option 2: Hostinger VPS / Ubuntu Linux Cloud Server (Professional & Full Control)

Agar aapke paas **Hostinger VPS** ya koi bhi Ubuntu Cloud VPS hai (Rs. 400-500/month):

### 1. Server Setup:
SSH login karein:
```bash
ssh root@YOUR_SERVER_IP
```
Node.js & PM2 install karein:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx git
sudo npm install -g pm2
```

### 2. Code Clone & Build:
```bash
cd /var/www
git clone https://github.com/YOUR_USERNAME/travelx-fare-manager.git travelx
cd travelx

# Install backend dependencies
npm install

# Build modern frontend
cd client
npm install
npm run build
cd ..
```

### 3. PM2 Process Manager Start:
```bash
# Server start karein aur background mein chalne dein
pm2 start server/index.js --name "travelx-b2b"
pm2 save
pm2 startup
```

### 4. Nginx Reverse Proxy Setup (Domain `rates.travelx.co.in`):
Nginx config banayein:
```bash
sudo nano /etc/nginx/sites-available/travelx
```
Paste karein:
```nginx
server {
    server_name rates.travelx.co.in;

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```
Enable karein aur SSL install karein:
```bash
sudo ln -s /etc/nginx/sites-available/travelx /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Free SSL (HTTPS) Certificate:
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d rates.travelx.co.in
```

---

## ⚡ Option 3: Local Office PC Cloudflare Tunnel (100% Free & Zero Cloud Cost)

Agar aap kisi third-party hosting ka monthly charge nahi dena chahte aur apne is computer se hi 500 agents ko live link dena chahte hain:

1. **Cloudflare Tunnel (Cloudflared)** download karein:
   - [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) par free account banayein.
   - **Tunnels** ➔ **Create Tunnel** ➔ Name: `travelx-rates`.
2. Windows connector command run karein:
   - Local service route karein:
     - Service: `HTTP`
     - URL: `localhost:5001`
   - Public Hostname set karein: `rates.travelx.co.in`.
3. **Fayda**:
   - Aapke PC par chal raha **Permanent Watchdog Daemon** process ko hamesha zinda rakhega.
   - Pure internet par agents bina kisi port-forwarding ya IP address ke `https://rates.travelx.co.in` open kar sakenge!

---

## 📱 Agents Ko Link Kaise Share Karein?

Aap apne WhatsApp broadcast ya B2B groups mein ye message bhej sakte hain:

```text
✈️ *TRAVELX B2B AIR FARES - LIVE AGENT PORTAL* ✈️
━━━━━━━━━━━━━━━━━━━━━━━━━━
Dear Travel Partner,

Ab aapko special air ticket rates ke liye Excel ka wait karne ki zaroorat nahi hai!

Hamare sabhi live non-stop & special group rates ab direct online check karein:
👉 *https://rates.travelx.co.in* (ya http://localhost:5173/?view=agent)

✨ *Portal Features:*
1. 🔍 *Live Search:* Kisi bhi city/airline ka rate 1 second mein dekhein.
2. 📱 *Mobile Friendly:* Apne mobile screen par "Add to Home Screen" karke App ki tarah chalayein.
3. 👁️ *Customer Mode:* Customer ke samne screen dikhane ke liye apna profit markup (+₹1000) add karein.
4. 📲 *1-Click Booking:* Direct WhatsApp booking & instant PNR hold request.

━━━━━━━━━━━━━━━━━━━━━━━━━━
*TravelX Special Air Fare Desk*
WhatsApp: +91 98888 88888
```

---

## 🛠️ Testing Locally Before Deploying

Local PC par test karne ke do tarike hain:
1. **Admin Desk View**:
   - Open karein: `http://localhost:5173`
   - Top right mein **"📱 B2B Agent View"** button par click karein.
2. **Direct B2B Agent View**:
   - Open karein: `http://localhost:5173/?view=agent` ya `http://localhost:5173/agent`
   - Yahan par na to vendor ka naam dikhega aur na net purchase rate. Sirf clean selling rates aur WhatsApp booking button dikhai dega.
