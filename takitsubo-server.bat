@echo off
chcp 65001 >nul
title ゲームの滝壺 - スマホ確認用サーバー

cd /d "%~dp0"

echo.
echo ========================================
echo   スマホ確認用ローカルサーバー
echo ========================================
echo.

rem LAN内のIPv4アドレスを取得
set "LOCAL_IP="
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$ip = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.AddressState -eq 'Preferred' } | Sort-Object InterfaceMetric | Select-Object -First 1 -ExpandProperty IPAddress; if ($ip) { $ip }"`) do set "LOCAL_IP=%%I"

if defined LOCAL_IP (
    echo スマホから以下のURLを開いてください。
    echo.
    echo   トップページ
    echo   http://%LOCAL_IP%:8765/
    echo.
) else (
    echo PCのIPアドレスを自動取得できませんでした。
    echo ipconfig でIPv4アドレスを確認してください。
    echo.
)

echo PCとスマホは同じWi-Fiに接続してください。
echo.
echo 終了するときは Ctrl+C を押してください。
echo ========================================
echo.

rem Pythonサーバー起動
where py >nul 2>&1
if %errorlevel%==0 (
    py -m http.server 8765 --bind 0.0.0.0
) else (
    python -m http.server 8765 --bind 0.0.0.0
)

pause