param([switch]$AllowPartial)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;using System.Drawing;using System.Drawing.Imaging;using System.Runtime.InteropServices;
public static class ArmedFrameInspector {
 public static double[] Inspect(string path){
  using(var b=new Bitmap(path)){
   var d=b.LockBits(new Rectangle(0,0,b.Width,b.Height),ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);
   int stride=Math.Abs(d.Stride);byte[] p=new byte[stride*b.Height];Marshal.Copy(d.Scan0,p,0,p.Length);b.UnlockBits(d);
   int l=b.Width,t=b.Height,r=-1,bt=-1,transparent=0,opaque=0,n=0;double sx=0,sy=0;
   for(int y=0;y<b.Height;y++)for(int x=0;x<b.Width;x++){
    int i=y*stride+x*4,a=p[i+3];if(a<5)transparent++;if(a<10)continue;
    l=Math.Min(l,x);t=Math.Min(t,y);r=Math.Max(r,x);bt=Math.Max(bt,y);if(a<220)continue;opaque++;
    int rr=p[i+2],g=p[i+1],bb=p[i];
    if(x>b.Width*.35&&x<b.Width*.65&&y>b.Height*.25&&y<b.Height*.60&&rr>65&&g>45&&bb<g*.78&&rr>g*1.06&&rr<g*1.85){sx+=x;sy+=y;n++;}
   }
   return new double[]{b.Width,b.Height,l,t,r+1,bt+1,transparent,opaque,p[3],p[(b.Width-1)*4+3],p[(b.Height-1)*stride+3],p[(b.Height-1)*stride+(b.Width-1)*4+3],n>0?sx/n:b.Width*.5,n>0?sy/n:b.Height*.42};
  }
 }
}
'@ -ReferencedAssemblies System.Drawing
$plan=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'prompts.json') -Raw -Encoding UTF8|ConvertFrom-Json
$assets=@();$missing=@();$invalid=@();$sourceErrors=@();$alignment=[ordered]@{}
foreach($j in $plan.jobs){
 $file=Join-Path $PSScriptRoot $j.file
 $a=[ordered]@{id=$j.id;file=$j.file;weapon=$j.weapon;direction=$j.direction;action=$j.action;frame=$j.frame;phase=$j.phase;status='missing'}
 if(Test-Path -LiteralPath $file){
  $m=[ArmedFrameInspector]::Inspect($file)
  $hash=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLower()
  $a.status='generated';$a.size=@([int]$m[0],[int]$m[1]);$a.visibleBounds=@([int]$m[2],[int]$m[3],[int]$m[4],[int]$m[5]);$a.transparentPixels=[int]$m[6];$a.opaquePixels=[int]$m[7];$a.cornerAlpha=@([int]$m[8],[int]$m[9],[int]$m[10],[int]$m[11]);$a.sha256=$hash;$a.torso=@([math]::Round($m[12],2),[math]::Round($m[13],2))
  if($m[6]-lt100 -or $m[7]-lt100 -or ($a.cornerAlpha|Where-Object {$_-gt10})){ $invalid+=$j.id }
  $recordPath=Join-Path $PSScriptRoot ('records/'+$j.id+'.json')
  if(Test-Path -LiteralPath $recordPath){
   $rec=Get-Content -LiteralPath $recordPath -Raw -Encoding UTF8|ConvertFrom-Json
   if((Test-Path -LiteralPath $rec.source)-and (Get-FileHash -LiteralPath $rec.source -Algorithm SHA256).Hash.ToLower()-eq$hash){$a.sourceVerified=$true}else{$a.sourceVerified=$false;$sourceErrors+=$j.id}
  }else{$a.sourceVerified=$false;$sourceErrors+=$j.id}
  $alignment[$j.id]=[ordered]@{size=$a.size;visibleBounds=$a.visibleBounds;torso=$a.torso}
 }else{$missing+=$j.id}
 $assets+=,[PSCustomObject]$a
}
$duplicates=@($assets|Where-Object {$_.status-eq'generated'}|Group-Object sha256|Where-Object {$_.Count-gt1}|ForEach-Object {$_.Group.id -join ', '})
$manifest=[ordered]@{format='individual-transparent-png';expected=$plan.expectedCount;weapons=$plan.weapons;directions=$plan.directions;frameCounts=$plan.frameCounts;runSequence=$plan.runSequence;attackSequence=$plan.attackSequence;alignment='suggested torso-centroid registration only; original PNG pixels unchanged';assets=$assets}
$manifest|ConvertTo-Json -Depth 10|Set-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Encoding UTF8
$alignJson=$alignment|ConvertTo-Json -Depth 6 -Compress
Set-Content -LiteralPath (Join-Path $PSScriptRoot 'alignment.js') -Value ('window.ARMED_ALIGNMENT='+$alignJson+';') -Encoding UTF8
$report=[ordered]@{expected=$plan.expectedCount;generated=@($assets|Where-Object {$_.status-eq'generated'}).Count;missing=$missing;invalidAlphaOrEmpty=$invalid;nativeSourceMismatch=$sourceErrors;duplicateFrames=$duplicates;checkedAt=[DateTime]::UtcNow.ToString('o')}
$report|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $PSScriptRoot 'validation.json') -Encoding UTF8
$report|ConvertTo-Json -Depth 6
if(-not$AllowPartial -and ($missing.Count -or $invalid.Count -or $sourceErrors.Count -or $duplicates.Count)){throw 'Armed art verification failed; see validation.json'}
