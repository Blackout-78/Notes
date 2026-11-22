@echo off
rem Removes the shortcuts. Your notes stay in %APPDATA%\Notes unless you choose to delete them.
powershell -NoProfile -Command "foreach($d in @([Environment]::GetFolderPath('Programs'),[Environment]::GetFolderPath('Desktop'))){ Remove-Item (Join-Path $d 'Notes.lnk') -ErrorAction SilentlyContinue }"
echo Shortcuts removed.
set /p DELDATA=Also delete all your notes and pictures? Type YES to delete, anything else keeps them: 
if /i "%DELDATA%"=="YES" rmdir /s /q "%APPDATA%\Notes"
echo.
echo To finish, close this window and delete the Notes folder.
pause
