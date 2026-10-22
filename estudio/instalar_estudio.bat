@echo off
chcp 65001 >nul
title Instalar FOTOS JEFFERSON Estudio
setlocal
set "AQUI=%~dp0"
set "RAIZ=%AQUI%.."
set "VENV=%RAIZ%\.venv-estudio"

echo.
echo  FOTOS JEFFERSON Estudio - instalación
echo  =====================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo  Falta Python. Instálalo desde https://www.python.org/downloads/ ^(marca "Add to PATH"^) y vuelve a abrir esto.
  pause
  exit /b 1
)

REM Si el motor ya está instalado en esta PC, se reutiliza su entorno (ya tiene la IA de recorte y la GPU).
set "MOTOR_VENV=C:\dev\fotos-jeff-motor\pipeline\.venv"
if exist "%MOTOR_VENV%\Scripts\python.exe" (
  echo  Usando el entorno del motor que ya está instalado...
  set "VENV=%MOTOR_VENV%"
) else (
  if not exist "%VENV%\Scripts\python.exe" (
    echo  Creando entorno...
    python -m venv "%VENV%" || goto :error
  )
)

echo  Instalando lo necesario ^(puede tardar unos minutos^)...
"%VENV%\Scripts\python.exe" -m pip install --upgrade pip >nul
"%VENV%\Scripts\python.exe" -m pip install -r "%AQUI%requirements.txt" || goto :error

nvidia-smi >nul 2>nul
if not errorlevel 1 (
  "%VENV%\Scripts\python.exe" -c "import torch, sys; sys.exit(0 if torch.cuda.is_available() else 1)" >nul 2>nul
  if errorlevel 1 (
    echo  Tarjeta NVIDIA detectada: instalando la IA de recorte con GPU ^(descarga grande^)...
    "%VENV%\Scripts\python.exe" -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124 || goto :error
    "%VENV%\Scripts\python.exe" -m pip install transformers timm kornia einops || goto :error
  )
)

echo  Creando acceso directo en el escritorio...
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\FOTOS JEFFERSON Estudio.lnk'); $s.TargetPath='%VENV%\Scripts\pythonw.exe'; $s.Arguments='\"%AQUI%main.py\"'; $s.WorkingDirectory='%AQUI%'; $s.Save()"

echo.
echo  Listo. Abre "FOTOS JEFFERSON Estudio" desde el escritorio.
pause
exit /b 0

:error
echo.
echo  Algo falló en la instalación. Copia lo de arriba y mándalo para revisarlo.
pause
exit /b 1
