@echo off
set "AQUI=%~dp0"
if exist "C:\dev\fotos-jeff-motor\pipeline\.venv\Scripts\pythonw.exe" (
  start "" "C:\dev\fotos-jeff-motor\pipeline\.venv\Scripts\pythonw.exe" "%AQUI%main.py"
) else (
  start "" "%AQUI%..\.venv-estudio\Scripts\pythonw.exe" "%AQUI%main.py"
)
