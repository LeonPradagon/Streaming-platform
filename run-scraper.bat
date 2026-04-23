@echo off
title NETIX Scraper Engine - Hybrid Setup
color 0A

echo ======================================================
echo           NETIX HYBRID SCRAPER ENGINE
echo ======================================================
echo.
echo [1/3] Menjalankan Next.js Dev Server...
start "NETIX-DEV" cmd /c "npm run dev"

echo [2/3] Menunggu server siap (10 detik)...
timeout /t 10 /nobreak > nul

echo [3/3] Menjalankan Cloudflare Tunnel...
echo.
echo URL Publik Anda akan muncul di bawah ini (cari yang berakhiran .trycloudflare.com)
echo.
start "NETIX-TUNNEL" cmd /k "cloudflared tunnel --url http://localhost:3000"

echo.
echo ======================================================
echo SELESAI! 
echo Silakan salin URL .trycloudflare.com dari jendela hitam kedua
echo untuk mengakses Admin dari mana saja.
echo ======================================================
echo.
pause
