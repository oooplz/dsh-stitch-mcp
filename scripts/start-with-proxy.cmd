@echo off
REM Starts DeepSeek Harness with an outbound proxy visible to its Node runtime.
REM See scripts/start-with-proxy.ps1 for why this is required.

set "NODE_USE_ENV_PROXY=1"
set "HTTPS_PROXY=http://127.0.0.1:7897"
set "HTTP_PROXY=%HTTPS_PROXY%"

set "DSH=%LOCALAPPDATA%\Programs\DeepSeek Harness\DeepSeek Harness.exe"
if not exist "%DSH%" (
  echo DeepSeek Harness not found at %DSH%
  exit /b 1
)

start "" "%DSH%"
