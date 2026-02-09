# PowerShell script to allow Node.js backend through Windows Firewall
# Run this as Administrator

Write-Host "Setting up Windows Firewall rule for PawSewa Backend..." -ForegroundColor Cyan

# Check if rule already exists
$existingRule = Get-NetFirewallRule -DisplayName "PawSewa Backend - Port 3000" -ErrorAction SilentlyContinue

if ($existingRule) {
    Write-Host "Firewall rule already exists. Removing old rule..." -ForegroundColor Yellow
    Remove-NetFirewallRule -DisplayName "PawSewa Backend - Port 3000"
}

# Create new inbound rule for port 3000
New-NetFirewallRule -DisplayName "PawSewa Backend - Port 3000" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 3000 `
    -Action Allow `
    -Profile Any `
    -Description "Allow incoming connections to PawSewa Node.js backend on port 3000"

Write-Host "✅ Firewall rule created successfully!" -ForegroundColor Green
Write-Host "Mobile devices can now connect to: http://192.168.1.8:3000" -ForegroundColor Green
Write-Host ""
Write-Host "Test from your phone browser: http://192.168.1.8:3000/api/v1/health" -ForegroundColor Cyan
