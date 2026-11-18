@echo off
cd /d "%~dp0"
echo ==============================================
echo [1/2] Dang nap Firmware len ESP32...
echo ==============================================
"C:\Users\hp\.platformio\penv\Scripts\pio.exe" run -e esp32dev -t upload
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Nap firmware that bai. Vui long kiem tra cong COM hoac driver!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ==============================================
echo [2/2] Dang nap Web Game Filesystem (LittleFS)...
echo ==============================================
"C:\Users\hp\.platformio\penv\Scripts\pio.exe" run -e esp32dev -t uploadfs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Nap Filesystem that bai!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ==============================================
echo [THANH CONG] Da nap xong toan bo Game vao ESP32!
echo Hay ket noi vao Wi-Fi: BOARD GAME (Mat khau: 12345678)
echo Truy cap: http://192.168.4.1/ de choi!
echo ==============================================
pause

