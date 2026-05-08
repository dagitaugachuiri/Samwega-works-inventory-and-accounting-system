@echo off
echo Attempting to add Firewall rule for Port 8080...
netsh advfirewall firewall add rule name="Allow Node Port 8080" dir=in action=allow protocol=TCP localport=8080
if %errorlevel% equ 0 (
    echo Successfully added firewall rule!
) else (
    echo Failed to add rule. Please right-click this file and select "Run as administrator".
)
pause
