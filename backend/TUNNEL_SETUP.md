# Ngrok Tunnel Setup

Use an ngrok tunnel so your mobile app can reach the backend from anywhere (home, office, mobile data) without changing the IP.

## 1. Install ngrok

- Download: https://ngrok.com/download
- Or: `npm install -g ngrok` (if using npm)

## 2. Sign up & add authtoken (required)

Ngrok requires a free account:

1. Sign up: https://dashboard.ngrok.com/signup
2. Get your authtoken: https://dashboard.ngrok.com/get-started/your-authtoken
3. Run once (replace with your token):

```bash
ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
```

## 3. Start the backend

```bash
cd backend
npm run dev
```

## 4. Start the tunnel

In a **second terminal**:

```bash
cd backend
npm run tunnel
```

This runs `ngrok http 3000` and prints a public URL like `https://abc123.ngrok-free.app`.

## 5. Configure the mobile app

1. Open the **user_app** on your phone
2. On the Login screen, tap **"Can't connect? Set server URL"**
3. Paste the ngrok URL (e.g. `https://abc123.ngrok-free.app`)
4. Tap **Save**
5. Try logging in again

The app will use this URL until you change it. No more IP updates when switching networks.

## Notes

- The free ngrok URL changes each time you restart `npm run tunnel`. Update it in the app when that happens.
- Paid ngrok plans provide a fixed subdomain so you never have to update the URL.
