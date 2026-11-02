# Starts DeepSeek Harness with an outbound proxy visible to its Node runtime.
#
# Stitch is a *remote* MCP endpoint, and the Streamable HTTP transport runs inside
# the Harness process. Node's built-in fetch ignores HTTPS_PROXY unless
# NODE_USE_ENV_PROXY=1 is present when the process starts, and a plugin cannot set
# that for its host. Launching through this script therefore gives the host the
# proxy it needs.
#
# Adjust PROXY if your local proxy listens elsewhere.

$Proxy = 'http://127.0.0.1:7897'

$env:NODE_USE_ENV_PROXY = '1'
$env:HTTPS_PROXY = $Proxy
$env:HTTP_PROXY = $Proxy

$exe = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\DeepSeek Harness.exe'
if (-not (Test-Path $exe)) {
    Write-Error "DeepSeek Harness not found at $exe"
    exit 1
}

Write-Host "Starting DeepSeek Harness with HTTPS_PROXY=$Proxy" -ForegroundColor Cyan
& $exe
