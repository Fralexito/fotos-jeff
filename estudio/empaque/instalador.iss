; Inno Setup: instalador de FOTOS JEFFERSON Estudio
#ifndef Version
  #define Version "0.1"
#endif

[Setup]
AppId={{6C1F0A52-3E7B-4D0E-9C31-7A5E2B0F1D44}
AppName=FOTOS JEFFERSON Estudio
AppVersion={#Version}
AppPublisher=FOTOS JEFFERSON
DefaultDirName={autopf}\FOTOS JEFFERSON Estudio
DefaultGroupName=FOTOS JEFFERSON
DisableProgramGroupPage=yes
OutputDir=..\..\dist
OutputBaseFilename=FOTOS-JEFFERSON-Estudio-Setup-{#Version}
SetupIconFile=icono.ico
UninstallDisplayIcon={app}\FOTOS JEFFERSON Estudio.exe
Compression=lzma2/max
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequiredOverridesAllowed=dialog
WizardStyle=modern

[Languages]
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "escritorio"; Description: "Crear acceso directo en el escritorio"; GroupDescription: "Accesos directos:"

[Files]
Source: "..\..\dist\FOTOS JEFFERSON Estudio\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\FOTOS JEFFERSON Estudio"; Filename: "{app}\FOTOS JEFFERSON Estudio.exe"
Name: "{autodesktop}\FOTOS JEFFERSON Estudio"; Filename: "{app}\FOTOS JEFFERSON Estudio.exe"; Tasks: escritorio

[Run]
Filename: "{app}\FOTOS JEFFERSON Estudio.exe"; Description: "Abrir FOTOS JEFFERSON Estudio"; Flags: nowait postinstall skipifsilent
