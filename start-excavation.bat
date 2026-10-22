@echo off
setlocal
chcp 65001 >nul
title Takitsubo Excavation - Local Preview
cd /d "%~dp0"

where py >nul 2>&1
if errorlevel 1 goto use_python
py -3 "%~dp0scripts\preview_excavation.py" %*
goto finished

:use_python
python "%~dp0scripts\preview_excavation.py" %*

:finished
if errorlevel 1 (
    echo.
    echo Preview could not start. See the message above.
    pause
)
endlocal
