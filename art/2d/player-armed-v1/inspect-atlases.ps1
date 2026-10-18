param([switch]$AllowPartial)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;using System.Drawing;using System.Drawing.Imaging;using System.Runtime.InteropServices;
public static class ArmedAtlasInspector {
 static int Cut(int[] counts,int size,int part,out int warning){
  int target=size*part/3,radius=Math.Max(8,size/15),best=target,min=int.MaxValue,dist=int.MaxValue;
  for(int p=Math.Max(1,target-radius);p<Math.Min(size-1,target+radius);p++){int v=counts[p],dd=Math.Abs(p-target);if(v<min||(v==min&&dd<dist)){min=v;best=p;dist=dd;}}
  warning=min>0?1:0;return best;
 }
 public static double[][] Inspect(string path){
  using(var b=new Bitmap(path)){
   var d=b.LockBits(new Rectangle(0,0,b.Width,b.Height),ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);
   int stride=Math.Abs(d.Stride);byte[] p=new byte[stride*b.Height];Marshal.Copy(d.Scan0,p,0,p.Length);b.UnlockBits(d);
   int[] cols=new int[b.Width],rows=new int[b.Height];int transparent=0,opaque=0;
   for(int y=0;y<b.Height;y++)for(int x=0;x<b.Width;x++){int a=p[y*stride+x*4+3];if(a<5)transparent++;if(a>=60){cols[x]++;rows[y]++;}if(a>=220)opaque++;}
   int e1,e2,e3,e4;int cx1=Cut(cols,b.Width,1,out e1),cx2=Cut(cols,b.Width,2,out e2),cy1=Cut(rows,b.Height,1,out e3),cy2=Cut(rows,b.Height,2,out e4);
   int[] xs={0,cx1,cx2,b.Width},ys={0,cy1,cy2,b.Height};
   double[][] result=new double[10][];
   result[0]=new double[]{b.Width,b.Height,transparent,opaque,p[3],p[(b.Width-1)*4+3],p[(b.Height-1)*stride+3],p[(b.Height-1)*stride+(b.Width-1)*4+3],cx1,cx2,cy1,cy2,e1+e2+e3+e4};
   for(int row=0;row<3;row++)for(int col=0;col<3;col++){
    int x0=xs[col],y0=ys[row],w=xs[col+1]-x0,h=ys[row+1]-y0,l=w,t=h,r=-1,bt=-1,n=0,op=0;double sx=0,sy=0;
    for(int y=0;y<h;y++)for(int x=0;x<w;x++){int i=(y0+y)*stride+(x0+x)*4,a=p[i+3];if(a<10)continue;l=Math.Min(l,x);t=Math.Min(t,y);r=Math.Max(r,x);bt=Math.Max(bt,y);if(a<220)continue;op++;int rr=p[i+2],g=p[i+1],bb=p[i];if(x>w*.25&&x<w*.75&&y>h*.23&&y<h*.65&&rr>65&&g>45&&bb<g*.78&&rr>g*1.06&&rr<g*1.85){sx+=x;sy+=y;n++;}}
    result[row*3+col+1]=new double[]{x0,y0,w,h,l,t,r+1,bt+1,op,n>0?sx/n:w*.5,n>0?sy/n:h*.42};
   }
   return result;
  }
 }
}
'@ -ReferencedAssemblies System.Drawing
$plan=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'prompts.json') -Raw -Encoding UTF8|ConvertFrom-Json
$atlases=@();$frames=@();$alignment=[ordered]@{};$missing=@();$invalid=@();$sourceErrors=@();$emptyErrors=@();$gutterWarnings=@()
foreach($j in $plan.jobs){
 $file=Join-Path $PSScriptRoot $j.file
 if(-not(Test-Path -LiteralPath $file)){$missing+=$j.id;continue}
 $data=[ArmedAtlasInspector]::Inspect($file);$m=$data[0];$hash=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLower()
 $recordPath=Join-Path $PSScriptRoot ('records/'+$j.id+'.json');$verified=$false
 if(Test-Path -LiteralPath $recordPath){$rec=Get-Content -LiteralPath $recordPath -Raw -Encoding UTF8|ConvertFrom-Json;if((Test-Path -LiteralPath $rec.source)-and (Get-FileHash -LiteralPath $rec.source -Algorithm SHA256).Hash.ToLower()-eq$hash){$verified=$true}}
 if(-not$verified){$sourceErrors+=$j.id}
 $a=[ordered]@{id=$j.id;file=$j.file;weapon=$j.weapon;direction=$j.direction;size=@([int]$m[0],[int]$m[1]);transparentPixels=[int]$m[2];opaquePixels=[int]$m[3];cornerAlpha=@([int]$m[4],[int]$m[5],[int]$m[6],[int]$m[7]);cutsX=@(0,[int]$m[8],[int]$m[9],[int]$m[0]);cutsY=@(0,[int]$m[10],[int]$m[11],[int]$m[1]);sha256=$hash;sourceVerified=$verified}
 if($m[2]-lt100 -or $m[3]-lt100 -or ($a.cornerAlpha|Where-Object {$_-gt10})){$invalid+=$j.id}
 if($m[12]-gt0){$gutterWarnings+=$j.id}
 foreach($f in $j.frames){
  $cell=$data[[int]$f.cell]
  $frame=[ordered]@{id=$f.id;file=$j.file;atlas=$j.id;weapon=$f.weapon;direction=$f.direction;action=$f.action;frame=$f.frame;phase=$f.phase;cell=$f.cell;rect=@([int]$cell[0],[int]$cell[1],[int]$cell[2],[int]$cell[3]);size=@([int]$cell[2],[int]$cell[3]);visibleBounds=@([int]$cell[4],[int]$cell[5],[int]$cell[6],[int]$cell[7]);opaquePixels=[int]$cell[8];torso=@([math]::Round($cell[9],2),[math]::Round($cell[10],2))}
  if($cell[8]-lt100){$invalid+=$f.id}
  $alignment[$f.id]=[ordered]@{rect=$frame.rect;size=$frame.size;visibleBounds=$frame.visibleBounds;torso=$frame.torso}
  $frames+=,[PSCustomObject]$frame
 }
 if($data[8][8]-gt30 -or $data[9][8]-gt30){$emptyErrors+=$j.id}
 $atlases+=,[PSCustomObject]$a
}
$manifest=[ordered]@{format=$plan.format;expectedAtlases=$plan.expectedAtlases;expectedFrames=$plan.expectedFrames;weapons=$plan.weapons;directions=$plan.directions;frameCounts=$plan.frameCounts;runSequence=$plan.runSequence;attackSequence=$plan.attackSequence;rectFormat='source x,y,width,height; alpha-gutter cuts, PNG pixels unchanged';alignment='suggested torso centroid per cell; calibrate world footpoints when integrating';atlases=$atlases;frames=$frames}
$manifest|ConvertTo-Json -Depth 10|Set-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Encoding UTF8
$alignJson=$alignment|ConvertTo-Json -Depth 6 -Compress
Set-Content -LiteralPath (Join-Path $PSScriptRoot 'alignment.js') -Value ('window.ARMED_ALIGNMENT='+$alignJson+';') -Encoding UTF8
$report=[ordered]@{expectedAtlases=$plan.expectedAtlases;generatedAtlases=$atlases.Count;expectedFrames=$plan.expectedFrames;indexedFrames=$frames.Count;missing=$missing;invalidAlphaOrEmpty=$invalid;nativeSourceMismatch=$sourceErrors;unexpectedContentInEmptyCells=$emptyErrors;gridGutterWarnings=$gutterWarnings;checkedAt=[DateTime]::UtcNow.ToString('o')}
$report|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $PSScriptRoot 'validation.json') -Encoding UTF8
$report|ConvertTo-Json -Depth 6
if(-not$AllowPartial -and ($missing.Count -or $invalid.Count -or $sourceErrors.Count -or $emptyErrors.Count -or $gutterWarnings.Count)){throw 'Atlas verification failed; inspect validation.json'}
