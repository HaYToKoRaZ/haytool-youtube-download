#define AppName "Multimedia HaYTooL"
#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

[Setup]
AppId={{47A5F3E8-8C3D-4C40-A937-CB6B35A062B1}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} v{#AppVersion}
AppPublisher=HaYTo
AppPublisherURL=https://haytokoraz.github.io/
AppSupportURL=https://haytokoraz.github.io/haytool-youtube-download/
AppUpdatesURL=https://github.com/HaYToKoRaZ/haytool-youtube-download/releases
AppContact=korazhayto@gmail.com
DefaultDirName={localappdata}\Programs\HaYTooL\Multimedia HaYTooL
DefaultGroupName=HaYTooL
AllowNoIcons=yes
DisableProgramGroupPage=no
UninstallDisplayIcon={app}\Multimedia HaYTooL.exe
SetupIconFile=icon.ico
UninstallIconFile=icon.ico
WizardImageFile=installer-banner.png
WizardImageBackColor=#2F1442
WizardSmallImageFile=installer-small.png
WizardSmallImageBackColor=#2F1442
WizardBackColor=#F4EEFA
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

[CustomMessages]
english.WelcomeLinks=Explore: <a href="https://haytokoraz.github.io/haytool-youtube-download/">Website</a>  ·  <a href="https://haytokoraz.github.io/">HaYTooL Portal</a>
turkish.WelcomeLinks=Ziyaret edin: <a href="https://haytokoraz.github.io/haytool-youtube-download/">Web Sitesi</a>  ·  <a href="https://haytokoraz.github.io/">HaYTooL Portalı</a>

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional icons:"; Flags: unchecked

[Files]
Source: "..\installer-source\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Multimedia HaYTooL"; Filename: "{app}\Multimedia HaYTooL.exe"
Name: "{autodesktop}\Multimedia HaYTooL"; Filename: "{app}\Multimedia HaYTooL.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\Multimedia HaYTooL.exe"; Description: "Launch Multimedia HaYTooL"; Flags: postinstall nowait skipifsilent

[Code]
var
  WelcomeLinksLabel: TNewLinkLabel;
  UninstallLinksLabel: TNewLinkLabel;

procedure WelcomeLinksClick(Sender: TObject; const Link: String; LinkType: TSysLinkType);
var
  ErrorCode: Integer;
begin
  if LinkType = sltURL then
  begin
    if not ShellExec('open', Link, '', '', SW_SHOWNORMAL, ewNoWait, ErrorCode) then
      MsgBox(SysErrorMessage(ErrorCode), mbError, MB_OK);
  end;
end;

procedure InitializeWizard;
begin
  WelcomeLinksLabel := TNewLinkLabel.Create(WizardForm);
  WelcomeLinksLabel.Parent := WizardForm.WelcomePage;
  WelcomeLinksLabel.Caption := ExpandConstant('{cm:WelcomeLinks}');
  WelcomeLinksLabel.OnLinkClick := @WelcomeLinksClick;
  WelcomeLinksLabel.Left := WizardForm.WelcomeLabel2.Left;
  WelcomeLinksLabel.Top := WizardForm.WelcomeLabel2.Top + WizardForm.WelcomeLabel2.Height + ScaleY(12);
  WelcomeLinksLabel.Width := WizardForm.WelcomeLabel2.Width;
  WelcomeLinksLabel.Height := ScaleY(24);
  WelcomeLinksLabel.Anchors := [akLeft, akRight, akTop];
  WelcomeLinksLabel.UseVisualStyle := True;
end;

procedure InitializeUninstallProgressForm;
begin
  UninstallLinksLabel := TNewLinkLabel.Create(UninstallProgressForm);
  UninstallLinksLabel.Parent := UninstallProgressForm.MainPanel;
  UninstallLinksLabel.Caption := ExpandConstant('{cm:WelcomeLinks}');
  UninstallLinksLabel.OnLinkClick := @WelcomeLinksClick;
  UninstallLinksLabel.Left := ScaleX(8);
  UninstallLinksLabel.Top := UninstallProgressForm.MainPanel.Height - ScaleY(30);
  UninstallLinksLabel.Width := UninstallProgressForm.MainPanel.Width - ScaleX(16);
  UninstallLinksLabel.Height := ScaleY(24);
  UninstallLinksLabel.Anchors := [akLeft, akRight, akBottom];
  UninstallLinksLabel.UseVisualStyle := True;
end;
