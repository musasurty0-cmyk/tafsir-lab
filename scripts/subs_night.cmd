@echo off
REM Launched by Windows Task Scheduler, NOT by a shell.
REM
REM Attempt 1 used `Start-Process -WindowStyle Hidden` from a PowerShell that
REM was itself a child of the agent. That does NOT escape the Windows Job
REM Object the agent's children live in: when the session ended both the
REM transcriber and yt-dlp were killed with it, eight minutes in, mid-lecture,
REM with an empty stderr -- the signature of a tree kill, not a fault.
REM A scheduled task's parent is the Task Scheduler service, so it survives.
REM
REM Attempt 2 (schtasks defaults) queued and never started: DisallowStartIfOn-
REM Batteries is True by default and this machine is on battery.
REM
REM Attempt 3 exited 1 instantly. Task Scheduler hands you a MINIMAL
REM environment -- none of python, yt-dlp or ffmpeg are on its PATH, and the
REM "not recognized" went to cmd's own stderr, which nothing was capturing.
REM Hence: every path absolute, and the whole script's output captured at the
REM bottom of this file rather than per-command.

set "PY=C:\Python314\python.exe"
set "PATH=C:\Python314;C:\Python314\Scripts;C:\Users\musas\bin;C:\Users\musas\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin;%PATH%"
set "OUT=C:\Users\musas\tafsir-source"
set "PL=PLZmiPrHYOIsTSedCe0b8icp-eFH9UomDk"

cd /d "C:\Users\musas\Tafsir Lab" || (echo cannot cd to repo >> "%OUT%\cmd.log" & exit /b 1)

echo. >> "%OUT%\cmd.log"
echo ==== night.cmd started %DATE% %TIME% ==== >> "%OUT%\cmd.log"
"%PY%" -c "import sys;print('python',sys.version)" >> "%OUT%\cmd.log" 2>&1
yt-dlp --version >> "%OUT%\cmd.log" 2>&1
ffmpeg -version 2>&1 | findstr /B "ffmpeg version" >> "%OUT%\cmd.log"

REM Audio first, in the background. The runner tolerates files that have not
REM landed yet and picks them up on a later pass, so these run concurrently.
start "ytdl" /b "%PY%" scripts\ytpl.py fetch %PL% >> "%OUT%\dl.log" 2>&1

"%PY%" scripts\subs_night.py %PL% --pipeline "%OUT%\_pipeline" --start 6 >> "%OUT%\night.out" 2>&1
echo ==== night.cmd exited %ERRORLEVEL% at %TIME% ==== >> "%OUT%\cmd.log"
