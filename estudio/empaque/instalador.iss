; Inno Setup: instalador y desinstalador de Fotos Studio J
#ifndef Version
  #define Version "0.1"
#endif

[Setup]
AppId={{6C1F0A52-3E7B-4D0E-9C31-7A5E2B0F1D44}
AppName=Fotos Studio J
AppVersion={#Version}
AppPublisher=FOTOS JEFFERSON
DefaultDirName={autopf}\Fotos Studio J
DefaultGroupName=Fotos Studio J
DisableProgramGroupPage=yes
OutputDir=..\..\dist
OutputBaseFilename=Fotos-Studio-J-Setup-{#Version}
SetupIconFile=icono.ico
UninstallDisplayIcon={app}\Fotos Studio J.exe
UninstallDisplayName=Fotos Studio J
UninstallFilesDir={app}\desinstalar
CloseApplications=yes
Compression=lzma2/max
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequiredOverridesAllowed=dialog
WizardStyle=modern
WizardSizePercent=110
WizardImageFile=asistente_100.bmp,asistente_125.bmp,asistente_150.bmp,asistente_200.bmp
WizardSmallImageFile=asistente_chica_100.bmp,asistente_chica_125.bmp,asistente_chica_150.bmp,asistente_chica_200.bmp
WizardImageStretch=yes

[Languages]
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "escritorio"; Description: "Crear acceso directo en el escritorio"; GroupDescription: "Accesos directos:"

[Files]
Source: "..\..\dist\Fotos Studio J\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Fotos Studio J"; Filename: "{app}\Fotos Studio J.exe"
Name: "{group}\Desinstalar Fotos Studio J"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Fotos Studio J"; Filename: "{app}\Fotos Studio J.exe"; Tasks: escritorio

[Run]
Filename: "{app}\Fotos Studio J.exe"; Description: "Abrir Fotos Studio J"; Flags: nowait postinstall skipifsilent

[InstallDelete]
; versiones anteriores se llamaban "FOTOS JEFFERSON Estudio"
Type: files; Name: "{app}\FOTOS JEFFERSON Estudio.exe"
Type: files; Name: "{autodesktop}\FOTOS JEFFERSON Estudio.lnk"
Type: filesandordirs; Name: "{autoprograms}\FOTOS JEFFERSON"

[Messages]
es.WelcomeLabel1=Bienvenido a Fotos Studio J
es.WelcomeLabel2=Vas a instalar Fotos Studio J [ver. {#Version}] en esta computadora.%n%nTrae las fotos, ordénalas por colegio y salón, edítalas y déjalas listas para imprimir, en 4 pasos.%n%nCierra los demás programas antes de seguir.
es.FinishedHeadingLabel=¡Listo! Fotos Studio J ya está instalado
es.FinishedLabel=Puedes abrirlo desde el acceso directo del escritorio o del menú Inicio.%n%nSi algún día quieres quitarlo, busca "Desinstalar Fotos Studio J" en el menú Inicio.
es.ClickFinish=Pulsa Finalizar para cerrar el asistente.
; el desinstalador quita solo el programa; la biblioteca de fotos y los ajustes no se tocan
es.UninstalledAll=Fotos Studio J se desinstaló. Tus fotos y tu biblioteca siguen intactas en su carpeta.
