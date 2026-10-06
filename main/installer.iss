#define AppName "Multimedia HaYTooL"
#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

[Setup]
AppId={{47A5F3E8-8C3D-4C40-A937-CB6B35A062B1}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=HaYTo
DefaultDirName={localappdata}\Programs\Multimedia HaYTooL
DefaultGroupName=Multimedia HaYTooL
UninstallDisplayIcon={app}\Multimedia HaYTooL.exe
SetupIconFile=icon.ico
OutputDir=..\release
OutputBaseFilename=Multimedia-HaYTooL-Windows-Setup-v{#AppVersion}
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=lowest
WizardStyle=modern
Compression=lzma2/ultra64
SolidCompression=yes
ChangesAssociations=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "turkish"; MessagesFile: "compiler:Languages\Turkish.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional icons:"; Flags: unchecked

[Files]
Source: "..\installer-source\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Multimedia HaYTooL"; Filename: "{app}\Multimedia HaYTooL.exe"
Name: "{autodesktop}\Multimedia HaYTooL"; Filename: "{app}\Multimedia HaYTooL.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\Multimedia HaYTooL.exe"; Description: "Launch Multimedia HaYTooL"; Flags: postinstall nowait skipifsilent
