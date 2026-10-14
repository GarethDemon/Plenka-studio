@echo off
chcp 65001 >nul
cd /d "%~dp0.."
python -m pip install pillow
start "" http://localhost:8765
python admin\admin.py
pause
