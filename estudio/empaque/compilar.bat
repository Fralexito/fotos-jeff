@echo off
chcp 65001 >nul
title Compilar FOTOS JEFFERSON Estudio
setlocal
REM Arma el programa y su instalador en esta PC (lo mismo que hace GitHub).
REM Resultado: dist\FOTOS-JEFFERSON-Estudio-Setup-local.exe en la carpeta del repositorio.
set "AQUI=%~dp0"
pushd "%AQUI%..\.."
set "RAIZ=%CD%"
set "VENV=%RAIZ%\.venv-compilar"

echo.
echo  Compilar FOTOS JEFFERSON Estudio
echo  ================================
echo.

REM Python 3.11 (las librerías fijadas son para esa versión)
set "PY="
py -3.11 -c "import sys" >nul 2>nul && set "PY=py -3.11"
if not defined PY (
  python -c "import sys; sys.exit(0 if sys.version_info[:2]==(3,11) else 1)" >nul 2>nul && set "PY=python"
)
if not defined PY (
  echo  Falta Python 3.11. Instálalo desde https://www.python.org/downloads/release/python-3119/ y vuelve a abrir esto.
  goto :error
)

if not exist "%VENV%\Scripts\python.exe" (
  echo  [1/6] Creando entorno de compilación...
  %PY% -m venv "%VENV%" || goto :error
) else (
  echo  [1/6] Entorno de compilación ya existe.
)
set "PYV=%VENV%\Scripts\python.exe"

echo  [2/6] Instalando librerías ^(la primera vez tarda unos minutos^)...
"%PYV%" -m pip install --upgrade pip >nul
"%PYV%" -m pip install -r "%AQUI%requisitos-exe.txt" pytest || goto :error

echo  [3/6] Pruebas...
pushd "%RAIZ%\estudio"
set "QT_QPA_PLATFORM=offscreen"
"%PYV%" -m pytest -q tests || (popd & goto :error)
set "QT_QPA_PLATFORM="
popd

echo  [4/6] Armando el programa ^(10 a 15 minutos^)...
"%PYV%" "%AQUI%icono.py" || goto :error
"%PYV%" -m PyInstaller --noconfirm --clean --distpath dist --workpath build "%AQUI%estudio.spec" || goto :error

echo  [5/6] Probando el programa armado...
start "" /wait "dist\FOTOS JEFFERSON Estudio\FOTOS JEFFERSON Estudio.exe" --autoprueba "%TEMP%\fj_autoprueba.json"
type "%TEMP%\fj_autoprueba.json"
findstr /c:"\"ok\": true" "%TEMP%\fj_autoprueba.json" >nul || goto :error

echo  [6/6] Instalador...
set "ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if not exist "%ISCC%" set "ISCC=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"
if not exist "%ISCC%" (
  echo  No está Inno Setup 6 ^(https://jrsoftware.org/isdl.php^). El programa ya quedó en:
  echo    %RAIZ%\dist\FOTOS JEFFERSON Estudio\FOTOS JEFFERSON Estudio.exe
  goto :fin
)
"%ISCC%" /DVersion=local "%AQUI%instalador.iss" || goto :error
echo.
echo  Listo: %RAIZ%\dist\FOTOS-JEFFERSON-Estudio-Setup-local.exe

:fin
popd
echo.
pause
exit /b 0

:error
popd
echo.
echo  Algo falló. Mira el mensaje de arriba.
pause
exit /b 1
