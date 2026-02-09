#!/bin/bash

echo "🚨 SECURITY FIX SCRIPT"
echo "====================="
echo ""
echo "⚠️  BEFORE RUNNING THIS SCRIPT:"
echo "1. Change your MongoDB password in Atlas"
echo "2. Update backend/.env with new password"
echo "3. Backup your repository"
echo ""
read -p "Have you done all the above? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Please complete the steps above first!"
    exit 1
fi

echo ""
echo "📦 Creating backup..."
cd ..
cp -r PawSewa PawSewa-backup-$(date +%Y%m%d-%H%M%S)
cd PawSewa

echo ""
echo "🧹 Cleaning git history..."
echo "This will remove all traces of .env files from git history"
echo ""
read -p "Continue? This will rewrite history! (yes/no): " confirm2

if [ "$confirm2" != "yes" ]; then
    echo "❌ Aborted"
    exit 1
fi

# Remove .env files from history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch backend/.env apps/web/website/.env.local' \
  --prune-empty --tag-name-filter cat -- --all

echo ""
echo "🗑️  Cleaning up..."
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo "✅ Git history cleaned!"
echo ""
echo "📤 Next steps:"
echo "1. Force push to GitHub:"
echo "   git push origin --force --all"
echo "   git push origin --force --tags"
echo ""
echo "2. Close the GitHub security alert"
echo "3. Notify team members to re-clone"
echo ""
