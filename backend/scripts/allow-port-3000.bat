@echo off
:: Allow inbound TCP 3000 so Android emulator can reach the backend.
:: Run this once as Administrator (right-click -> Run as administrator).
netsh advfirewall firewall delete rule name="PawSewa Backend" >nul 2>&1
netsh advfirewall firewall add rule name="PawSewa Backend" dir=in action=allow protocol=TCP localport=3000
if %errorlevel% equ 0 (
  echo Firewall rule added. Emulator can now connect to http://10.0.2.2:3000
) else (
  echo Run this script as Administrator: right-click allow-port-3000.bat -^> Run as administrator
)
pause
