# 🚨 CRITICAL SECURITY FIX - .env Files Exposed

## What Happened
The `.env` files containing sensitive credentials were accidentally pushed to GitHub. This is a **HIGH SECURITY RISK**.

## Immediate Actions Required

### 1. Remove .env Files from Git History

Run these commands in your terminal:

```bash
# Remove .env files from git tracking
git rm --cached backend/.env
git rm --cached apps/web/website/.env.local

# Commit the removal
git add .gitignore
git add backend/.env.example
git add apps/web/website/.env.local.example
git commit -m "Security: Remove .env files and add examples"

# Push to GitHub
git push origin main
```

### 2. Rotate ALL Compromised Credentials

You MUST change these immediately:

#### A. MongoDB Connection String
1. Go to MongoDB Atlas
2. Database Access → Change password for user `admin`
3. Update `MONGO_URI` in your local `backend/.env`

#### B. JWT Secret
1. Generate a new secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
2. Update `JWT_SECRET` in `backend/.env`

#### C. Gmail App Password
1. Go to Google Account → Security → 2-Step Verification → App passwords
2. Delete the old app password
3. Generate a new one
4. Update `EMAIL_PASS` in `backend/.env`

#### D. Cloudinary Credentials
1. Go to Cloudinary Dashboard → Settings → Security
2. Click "Reset API Secret"
3. Update all three values in `backend/.env`:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

#### E. Google OAuth Client ID
1. Go to Google Cloud Console
2. APIs & Services → Credentials
3. Delete the old OAuth client
4. Create a new one
5. Update `GOOGLE_CLIENT_ID` in both:
   - `backend/.env`
   - `apps/web/website/.env.local`

### 3. Verify .env Files are Ignored

```bash
# Check git status - .env files should NOT appear
git status

# If they still appear, run:
git rm --cached backend/.env
git rm --cached apps/web/website/.env.local
```

### 4. Update GitHub Repository Settings

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Add these as repository secrets (for CI/CD):
   - `MONGO_URI`
   - `JWT_SECRET`
   - `EMAIL_USER`
   - `EMAIL_PASS`
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `GOOGLE_CLIENT_ID`

### 5. Monitor for Unauthorized Access

- Check MongoDB Atlas logs for unusual activity
- Check Cloudinary usage dashboard
- Monitor your Gmail for suspicious activity
- Check Google Cloud Console for unexpected API calls

## Prevention for Future

### Always Follow These Rules:

1. ✅ **NEVER** commit `.env` files
2. ✅ **ALWAYS** use `.env.example` files (without real values)
3. ✅ **ALWAYS** check `git status` before committing
4. ✅ **ALWAYS** verify `.gitignore` includes `.env`
5. ✅ **ALWAYS** rotate credentials if accidentally exposed

### Setup for New Developers:

```bash
# Copy example files
cp backend/.env.example backend/.env
cp apps/web/website/.env.local.example apps/web/website/.env.local

# Then fill in the actual values (never commit these!)
```

## Current Status

- ✅ `.gitignore` already includes `.env` files
- ✅ Created `.env.example` files
- ⏳ **YOU MUST**: Remove .env from git history (commands above)
- ⏳ **YOU MUST**: Rotate all credentials
- ⏳ **YOU MUST**: Push the security fix

## Files to Keep Private (NEVER COMMIT):

```
backend/.env
apps/web/website/.env.local
apps/web/admin/.env.local
```

## Files Safe to Commit:

```
backend/.env.example
apps/web/website/.env.local.example
.gitignore
```

---

## Quick Command Summary

```bash
# 1. Remove from git
git rm --cached backend/.env
git rm --cached apps/web/website/.env.local

# 2. Commit the fix
git add .
git commit -m "Security: Remove .env files, add examples, update .gitignore"

# 3. Push
git push origin main

# 4. Rotate ALL credentials (see section 2 above)
```

---

**⚠️ IMPORTANT**: Until you rotate all credentials, assume they are compromised. Act quickly!
