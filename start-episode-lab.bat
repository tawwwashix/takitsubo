@echo off
setlocal
chcp 65001 >nul
title Takitsubo Episode Lab - Local Preview
call "%~dp0start-excavation.bat" --page lab %*
endlocal
