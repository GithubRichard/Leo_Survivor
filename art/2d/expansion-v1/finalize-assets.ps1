param([switch]$AllowPartial)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
public static class ExpansionImageInspector {
 public static int[] Inspect(string path) {
  using(var b=new Bitmap(path)) {
   var rect=new Rectangle(0,0,b.Width,b.Height);
   var data=b.LockBits(rect,ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);
   int stride=Math.Abs(data.Stride); byte[] pixels=new byte[stride*b.Height];
   Marshal.Copy(data.Scan0,pixels,0,pixels.Length);b.UnlockBits(data);
   int l=b.Width,t=b.Height,r=-1,bt=-1,transparent=0;
   for(int y=0;y<b.Height;y++)for(int x=0;x<b.Width;x++) {
    int a=pixels[y*stride+x*4+3];if(a<5)transparent++;
    if(a<10)continue;l=Math.Min(l,x);t=Math.Min(t,y);r=Math.Max(r,x);bt=Math.Max(bt,y);
   }
   return new int[]{b.Width,b.Height,l,t,r+1,bt+1,transparent,pixels[3],pixels[(b.Width-1)*4+3],pixels[(b.Height-1)*stride+3],pixels[(b.Height-1)*stride+(b.Width-1)*4+3]};
  }
 }
}
'@ -ReferencedAssemblies System.Drawing
$plan=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'prompts.json') -Raw -Encoding UTF8|ConvertFrom-Json
$assets=@();$missing=@()
foreach($job in $plan.jobs){
 $path=Join-Path $PSScriptRoot $job.file
 $entry=[ordered]@{id=$job.id;label=$job.label;category=$job.category;file=$job.file;direction=$job.direction;state=$job.state;building=$job.building;dependencies=@($job.deps);status='missing'}
 if(Test-Path -LiteralPath $path){
  $m=[ExpansionImageInspector]::Inspect($path)
  $entry.status='generated';$entry.size=@($m[0],$m[1]);$entry.visibleBounds=@($m[2],$m[3],$m[4],$m[5]);$entry.transparentPixels=$m[6];$entry.cornerAlpha=@($m[7],$m[8],$m[9],$m[10]);$entry.sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLower()
 }else{$missing+=$job.id}
 $assets+=,[PSCustomObject]$entry
}
$reuse=@(
 @{id='wood';file='../sprites-v1/wood.png'},@{id='iron';file='../sprites-v2/iron.png';note='two ingots'},
 @{id='health_bar';file='../sprites-v2/health_bar.png';note='continuous red'},@{id='stamina_bar';file='../sprites-v2/stamina_bar.png';note='continuous green'},
 @{id='bear_trap';file='../sprites-v1/bear_trap.png'},@{id='bear_trap_hit';file='../sprites-v2/bear_trap_hit.png';note='round base; no old open jaws'},
 @{id='ballista';file='../sprites-v1/ballista.png'},@{id='house_base';file='../sprites-v1/house_base.png'},@{id='house_roof';file='../sprites-v1/house_roof.png'},
 @{id='survivor';file='../sprites-v1/survivor.png'},@{id='metal_cabinet';file='../sprites-v1/metal_cabinet.png'},@{id='metal_shelf';file='../sprites-v1/metal_shelf.png'},@{id='wood_cabinet';file='../sprites-v1/wood_cabinet.png'},@{id='wood_table';file='../sprites-v1/wood_table.png'},@{id='wood_chair';file='../sprites-v1/wood_chair.png'},@{id='player_run';file='../player-run-v1/manifest.json'}
)
$manifest=[ordered]@{schema=1;source='数值与内容扩展方案.md v1.1';tool='built-in image_gen';expected=$assets.Count;generated=@($assets|Where-Object status -eq 'generated').Count;assets=$assets;reuse=$reuse;missing=$missing;note='Models and action key poses; runtime mechanics are implemented separately.'}
$utf8=[Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'manifest.json'),($manifest|ConvertTo-Json -Depth 14),$utf8)
$fail=@($assets|Where-Object {$_.status -eq 'generated' -and ($_.transparentPixels -eq 0 -or $_.visibleBounds[2] -le $_.visibleBounds[0])})
$validation=[ordered]@{expected=$assets.Count;generated=$manifest.generated;missing=$missing;invalidAlphaOrEmpty=@($fail|ForEach-Object id);borderWarnings=@($assets|Where-Object {$_.status -eq 'generated' -and ($_.cornerAlpha|Measure-Object -Maximum).Maximum -gt 2}|ForEach-Object id)}
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'validation.json'),($validation|ConvertTo-Json -Depth 8),$utf8)
$validation|ConvertTo-Json -Depth 5
if(-not $AllowPartial -and ($missing.Count -gt 0 -or $fail.Count -gt 0)){throw 'Asset collection incomplete or alpha validation failed.'}
