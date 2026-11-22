@echo off
rem Adds Notes to the Start menu and the desktop. Run from inside the Notes folder.
set "APP=%~dp0Notes.exe"
powershell -NoProfile -Command "$s=New-Object -ComObject WScript.Shell; foreach($d in @([Environment]::GetFolderPath('Programs'),[Environment]::GetFolderPath('Desktop'))){ $l=$s.CreateShortcut((Join-Path $d 'Notes.lnk')); $l.TargetPath='%APP%'; $l.WorkingDirectory='%~dp0'; $l.Save() }"
echo Notes shortcuts added to the Start menu and desktop.
pause
