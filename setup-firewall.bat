@echo off
echo ========================================
echo PawSewa Backend - Firewall Setup
echo ========================================
echo.
echo This will add a Windows Firewall rule to allow
echo incoming connections on port 3000 for the backend.
echo.
echo You need to run this as Administrator!
echo.
pause

netsh advfirewall firewall add rule name="PawSewa Backend - Port 3000" dir=in action=allow protocol=TCP localport=3000

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo SUCCESS! Firewall rule created.
    echo ========================================
    echo.
    echo Mobile devices can now connect to:
    echo http://192.168.1.8:3000
    echo.
    echo Test from your phone browser:
    echo http://192.168.1.8:3000/api/v1/health
    echo.
) else (
    echo.
    echo ========================================
    echo ERROR! Failed to create firewall rule.
    echo ========================================
    echo.
    echo Make sure you run this file as Administrator:
    echo 1. Right-click on setup-firewall.bat
    echo 2. Select "Run as administrator"
    echo.
)

pause
