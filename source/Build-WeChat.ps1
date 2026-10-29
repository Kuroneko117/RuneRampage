$ErrorActionPreference = 'Stop'
$editor = 'D:\WeChatGameDev\Tools\CocosCreator\3.8.8\CocosCreator.exe'
$project = $PSScriptRoot
$arguments = "--project `"$project`" --build `"configPath=$project\buildConfig_wechatgame.json`""
$process = Start-Process -FilePath $editor -ArgumentList $arguments -WindowStyle Hidden -PassThru -Wait
if ($process.ExitCode -ne 36) { throw "Cocos build failed: $($process.ExitCode). See temp\builder\log." }
$domain = Join-Path $project 'build\wechatgame\openDataContext'
New-Item -ItemType Directory -Path $domain -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $project 'platform\open-data-context\index.js') -Destination (Join-Path $domain 'index.js') -Force
$gameConfig = Join-Path $project 'build\wechatgame\game.json'
$config = Get-Content -LiteralPath $gameConfig -Raw | ConvertFrom-Json
$config | Add-Member -NotePropertyName openDataContext -NotePropertyValue 'openDataContext' -Force
[IO.File]::WriteAllText($gameConfig, ($config | ConvertTo-Json -Depth 20), [Text.UTF8Encoding]::new($false))
$wxProject = Get-Content -LiteralPath (Join-Path $project 'build\wechatgame\project.config.json') -Raw | ConvertFrom-Json
if ($wxProject.appid -ne 'wx4f1fd04878261d71') { throw 'Unexpected WeChat AppID in output.' }
$files = @(Get-ChildItem -LiteralPath (Join-Path $project 'build\wechatgame') -File -Recurse)
$bytes = [long](($files | Measure-Object Length -Sum).Sum)
Write-Host ('Package: {0} bytes, {1:N3} MiB, {2} files' -f $bytes, ($bytes / 1MB), $files.Count)
if ($bytes -gt 3MB) { Write-Warning 'Project UI budget exceeded: 3 MiB. Inspect the actual output before release.' }
Write-Host "WeChat mini game build succeeded: $project\build\wechatgame"
