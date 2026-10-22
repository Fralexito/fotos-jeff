@echo off
REM Doble clic para encender el motor de edición de Fotos Jeff.
cd /d "%~dp0"
if exist .venv\Scripts\activate.bat call .venv\Scripts\activate.bat
python motor.py
pause
