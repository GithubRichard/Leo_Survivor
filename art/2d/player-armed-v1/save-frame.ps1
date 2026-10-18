param([Parameter(Mandatory=$true)][string]$Source,[Parameter(Mandatory=$true)][string]$Id)
$ErrorActionPreference='Stop'
$plan=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'prompts.json') -Raw -Encoding UTF8|ConvertFrom-Json
$job=@($plan.jobs|Where-Object {$_.id -ceq $Id})
if($job.Count -ne 1){throw 'Unknown or ambiguous art frame ID'}
$job=$job[0]
$sourcePath=[IO.Path]::GetFullPath($Source)
$nativeRoot=[IO.Path]::GetFullPath('C:/Users/79264/.codex/generated_images')+[IO.Path]::DirectorySeparatorChar
if(-not $sourcePath.StartsWith($nativeRoot,[StringComparison]::OrdinalIgnoreCase)-or [IO.Path]::GetExtension($sourcePath)-ne '.png'){throw 'Source must be a native generated PNG'}
$targetRoot=[IO.Path]::GetFullPath($PSScriptRoot)+[IO.Path]::DirectorySeparatorChar
$targetPath=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot $job.file))
if(-not $targetPath.StartsWith($targetRoot,[StringComparison]::OrdinalIgnoreCase)){throw 'Target outside armed art directory'}
Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
$refs=@($job.refs);foreach($dependency in $job.deps){$dep=$plan.jobs|Where-Object {$_.id -ceq $dependency};$refs+=,(Join-Path $PSScriptRoot $dep.file)}
$record=[ordered]@{id=$job.id;file=$job.file;weapon=$job.weapon;direction=$job.direction;action=$job.action;frame=$job.frame;source=$sourcePath;refs=$refs;prompt=$job.prompt;savedAt=[DateTime]::UtcNow.ToString('o');sha256=(Get-FileHash -LiteralPath $targetPath -Algorithm SHA256).Hash.ToLower()}
$record|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $PSScriptRoot ('records/'+$Id+'.json')) -Encoding UTF8
Write-Output ('Saved '+$Id)
