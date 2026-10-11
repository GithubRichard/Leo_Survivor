param([switch]$AllowPartial)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Drawing;
public static class RunFrameGeometry {
  public static double[] Inspect(string path) {
    using (var b = new Bitmap(path)) {
      int l=b.Width,t=b.Height,r=-1,bt=-1,count=0;
      double sx=0,sy=0;
      for(int y=0;y<b.Height;y++) for(int x=0;x<b.Width;x++) {
        var p=b.GetPixel(x,y);
        if(p.A<220) continue;
        l=Math.Min(l,x);t=Math.Min(t,y);r=Math.Max(r,x);bt=Math.Max(bt,y);
        if(y>b.Height*.29&&y<b.Height*.55&&x>b.Width*.20&&x<b.Width*.80&&p.R>70&&p.G>60&&p.B<p.G*.65&&p.R>p.G&&p.R<p.G*1.5){sx+=x;sy+=y;count++;}
      }
      if(r<l) throw new Exception("No opaque character: "+path);
      return new double[]{b.Width,b.Height,l,t,r+1,bt+1,count>0?sx/count:(l+r)/2.0,count>0?sy/count:b.Height*.42,b.GetPixel(0,0).A};
    }
  }
}
'@ -ReferencedAssemblies System.Drawing
$runDirections = @('east','south','west','north','southeast','northeast','southwest','northwest')
$runAlignment = [ordered]@{}
$runAnimations = [ordered]@{}
$runCount = 0
foreach($runDirection in $runDirections) {
  $runFrames = @()
  $runBase = $null
  foreach($runNumber in 1..3) {
    $runName = 'player_run_{0}_{1:00}.png' -f $runDirection,$runNumber
    $runPath = Join-Path $PSScriptRoot $runName
    if(-not (Test-Path -LiteralPath $runPath)) { if($AllowPartial){continue};throw "Missing $runName" }
    $runData = [RunFrameGeometry]::Inspect($runPath)
    if($null -eq $runBase){$runBase=$runData}
    $runRatio=$runData[1]/$runBase[1]
    # Align the torso across frames; feet can rise naturally during the passing pose.
    $runPivot=@([Math]::Round($runData[6],2),[Math]::Round($runData[7]+($runBase[5]-$runBase[7])*$runRatio,2))
    $runMeta=[ordered]@{size=@([int]$runData[0],[int]$runData[1]);opaqueBounds=@([int]$runData[2],[int]$runData[3],[int]$runData[4],[int]$runData[5]);pivot=$runPivot;bodyHeight=[Math]::Round($runData[1]*.72,2);cornerAlpha=[int]$runData[8]}
    $runAlignment[$runName]=$runMeta
    $runFrames+=,[ordered]@{file=$runName;frame=$runNumber;size=$runMeta.size;pivot=$runPivot;bodyHeight=$runMeta.bodyHeight}
    $runCount++
  }
  $runAnimations[$runDirection]=[ordered]@{frames=$runFrames;sequence=@(1,2,3,2)}
}
$runManifest=[ordered]@{format='individual-transparent-png';frameCount=$runCount;directions=8;framesPerDirection=3;screenCoordinates=$true;previewFps=8;alignment='suggested torso registration; common scale, PNG files unchanged';animations=$runAnimations}
$runUtf8=[System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot 'manifest.json'),($runManifest|ConvertTo-Json -Depth 12),$runUtf8)
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot 'alignment.js'),('window.RUN_ALIGNMENT = '+($runAlignment|ConvertTo-Json -Depth 8)+';'),$runUtf8)
[PSCustomObject]@{Frames=$runCount;Directions=$runDirections.Count;TransparentCorners=(@($runAlignment.Values|Where-Object cornerAlpha -gt 2).Count -eq 0)}
