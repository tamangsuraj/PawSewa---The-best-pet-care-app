# Google OAuth Setup - Simple Step-by-Step Guide

Follow these steps EXACTLY. Don't skip any step!

---

## PART 1: Create Google Cloud Project (5 minutes)

### Step 1: Go to Google Cloud Console
1. Open your browser
2. Go to: **https://console.cloud.google.com/**
3. Sign in with your Google account (tamangsuraj003@gmail.com or any Gmail)

### Step 2: Create New Project
1. At the top of the page, you'll see "Select a project" (or a project name)
2. Click on it
3. A popup will appear
4. Click the **"NEW PROJECT"** button (top right of popup)
5. Enter Project Name: **PawSewa**
6. Click **"CREATE"** button
7. Wait 10-20 seconds for project to be created
8. You'll see a notification - click **"SELECT PROJECT"**

---

## PART 2: Enable Required APIs (2 minutes)

### Step 3: Enable Google+ API
1. On the left sidebar, click **"APIs & Services"**
2. Click **"Library"** (under APIs & Services)
3. In the search box, type: **Google+ API**
4. Click on **"Google+ API"** from results
5. Click the blue **"ENABLE"** button
6. Wait for it to enable (5 seconds)

### Step 4: Enable Google Identity Toolkit
1. Click the back arrow or go back to Library
2. In the search box, type: **Google Identity Toolkit API**
3. Click on it
4. Click the blue **"ENABLE"** button
5. Wait for it to enable

---

## PART 3: Configure OAuth Consent Screen (3 minutes)

### Step 5: Set Up Consent Screen
1. On the left sidebar, click **"APIs & Services"**
2. Click **"OAuth consent screen"**
3. You'll see two options: "Internal" and "External"
4. Select **"External"** (click the radio button)
5. Click the blue **"CREATE"** button at the bottom

### Step 6: Fill App Information
1. **App name**: Type **PawSewa**
2. **User support email**: Select your email from dropdown
3. Scroll down to "Developer contact information"
4. **Email addresses**: Type your email (tamangsuraj003@gmail.com)
5. Click the blue **"SAVE AND CONTINUE"** button at the bottom

### Step 7: Skip Scopes
1. You're now on "Scopes" page
2. Just click **"SAVE AND CONTINUE"** (don't add anything)

### Step 8: Add Test Users
1. You're now on "Test users" page
2. Click **"+ ADD USERS"** button
3. Type your email: **tamangsuraj003@gmail.com**
4. Click **"ADD"** button
5. Click **"SAVE AND CONTINUE"**

### Step 9: Finish
1. You're on "Summary" page
2. Click **"BACK TO DASHBOARD"** button at the bottom

---

## PART 4: Create OAuth Credentials (MOST IMPORTANT!)

### Step 10: Create Web Client ID
1. On the left sidebar, click **"APIs & Services"**
2. Click **"Credentials"**
3. At the top, click **"+ CREATE CREDENTIALS"** button
4. From dropdown, select **"OAuth client ID"**

### Step 11: Configure Web Client
1. **Application type**: Select **"Web application"** from dropdown
2. **Name**: Type **PawSewa Web Client**
3. Under "Authorized JavaScript origins":
   - Click **"+ ADD URI"**
   - Type: **http://localhost:3001**
   - Click **"+ ADD URI"** again
   - Type: **http://localhost:3002**
4. Under "Authorized redirect URIs":
   - Click **"+ ADD URI"**
   - Type: **http://localhost:3001**
5. Click the blue **"CREATE"** button at the bottom

### Step 12: COPY YOUR CLIENT ID (CRITICAL!)
1. A popup will appear with "OAuth client created"
2. You'll see:
   - **Your Client ID**: Something like `123456789-abcdefg.apps.googleusercontent.com`
   - Your Client Secret: (ignore this)
3. **COPY THE CLIENT ID** - Click the copy icon next to it
4. **PASTE IT SOMEWHERE SAFE** (Notepad, Notes app, etc.)
5. Click **"OK"** to close the popup

---

## PART 5: Update Your Code (2 minutes)

### Step 13: Update Backend .env File
1. Open your project in VS Code
2. Open file: **`backend/.env`**
3. Find this line:
   ```
   GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   ```
4. Replace it with (paste your actual Client ID):
   ```
   GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
   ```
5. **Save the file** (Ctrl+S)

### Step 14: Update Website .env.local File
1. Open file: **`apps/web/website/.env.local`**
2. Find this line:
   ```
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   ```
3. Replace it with (paste your actual Client ID):
   ```
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
   ```
4. **Save the file** (Ctrl+S)

---

## PART 6: Restart Everything (1 minute)

### Step 15: Stop All Running Services
1. In VS Code, find the terminals running your services
2. Press **Ctrl+C** in each terminal to stop them
3. Or close all terminals

### Step 16: Start Backend
1. Open new terminal in VS Code
2. Type:
   ```bash
   cd backend
   npm run dev
   ```
3. Wait until you see "Server is running on port 3000"

### Step 17: Start Website
1. Open another new terminal
2. Type:
   ```bash
   cd apps/web/website
   npm run dev
   ```
3. Wait until you see "Ready in..."

---

## PART 7: Test It! (1 minute)

### Step 18: Test Google Sign-In
1. Open browser
2. Go to: **http://localhost:3001/login**
3. Click **"Continue with Google"** button
4. Select your Google account
5. Click **"Allow"** or **"Continue"**
6. You should be logged in! 🎉

---

## Troubleshooting

### If you still see "Error 401: invalid_client":
1. Double-check you copied the ENTIRE Client ID (including `.apps.googleusercontent.com`)
2. Make sure there are NO SPACES before or after the Client ID in .env files
3. Make sure you saved both .env files
4. Make sure you restarted both backend and website

### If you see "Access blocked: This app's request is invalid":
1. Go back to Google Cloud Console
2. Go to "OAuth consent screen"
3. Make sure your email is added as a test user
4. Make sure the app status is not "In production"

### If nothing works:
1. Delete the project in Google Cloud Console
2. Start over from Step 2
3. Make sure you're using the same Google account everywhere

---

## Summary Checklist

- [ ] Created Google Cloud Project "PawSewa"
- [ ] Enabled Google+ API
- [ ] Enabled Google Identity Toolkit API
- [ ] Configured OAuth consent screen
- [ ] Added yourself as test user
- [ ] Created Web OAuth Client ID
- [ ] Copied the Client ID
- [ ] Updated `backend/.env` with Client ID
- [ ] Updated `apps/web/website/.env.local` with Client ID
- [ ] Restarted backend server
- [ ] Restarted website server
- [ ] Tested Google Sign-In - IT WORKS! ✅

---

## Need Help?

If you're stuck on any step, take a screenshot and I can help you figure out what to click next!

**Your Client ID should look like this:**
```
123456789012-abc123def456ghi789jkl012mno345pq.apps.googleusercontent.com
```

It's a long string with numbers, letters, and ends with `.apps.googleusercontent.com`
