@echo off
cd /d D:\code\Ai\open-factory\apps\desktop
set VITE_E2E=true
bun run dev -- --host localhost
