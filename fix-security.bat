@echo off
echo.
echo ========================================
echo   SECURITY FIX SCRIPT FOR WINDOWS
echo ========================================
echo.
echo WARNING: This will rewrite git history!
echo.
echo BEFORE RUNNING THIS:
echo 1. Change MongoDB password in Atlas
echo 2. Update backend\.env with new password
echo 3. Backup your repository
echo.
set /p confirm="Have you done all the above? (yes/no): "

if not "%confirm%"=="yes" (
    echo.
    echo Aborted. Please complete the steps above first!
    pause
    exit /b 1
)

echo.
echo Creating backup...
cd ..
xcopy PawSewa PawSewa-backup-%date:~-4,4%%date:~-10,2%%date:~-7,2%\ /E /I /H /Y
cd PawSewa

echo.
echo ========================================
echo   OPTION 1: Simple Solution
echo ========================================
echo.
echo Delete and recreate the repository:
echo 1. Go to GitHub repository settings
echo 2. Delete this repository
echo 3. Create a new repository
echo 4. Run these commands:
echo.
echo    rd /s /q .git
echo    git init
echo    git add .
echo    git commit -m "Initial commit - secure"
echo    git remote add origin YOUR_NEW_REPO_URL
echo    git push -u origin main
echo.
echo ========================================
echo   OPTION 2: Clean History (Advanced)
echo ========================================
echo.
echo This requires git-filter-repo or BFG Repo-Cleaner
echo Download BFG from: https://rtyley.github.io/bfg-repo-cleaner/
echo.
echo Then run:
echo    java -jar bfg.jar --delete-files .env
echo    git reflog expire --expire=now --all
echo    git gc --prune=now --aggressive
echo    git push origin --force --all
echo.
pause
