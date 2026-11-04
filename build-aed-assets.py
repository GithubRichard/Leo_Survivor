"""Index delivered RGBA files without changing pixels."""
import hashlib
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parent
BASE=ROOT/'art/2d/emergency-aed-v1'
m=json.loads((BASE/'manifest.json').read_text(encoding='utf-8-sig'))
out={'atlases':{},'assets':{},'frames':{}}
for a in m['assets']:
    p=BASE/a['file']; digest=hashlib.sha256(p.read_bytes()).hexdigest()
    if digest!=a['sha256']: raise ValueError(a['file'])
    out['atlases']['aed_atlas_'+a['id']]={'src':p.relative_to(ROOT).as_posix()+'?v='+digest[:16],'size':a['size'],'crop':[0,0,*a['size']],'lazy':False,'maxWidth':a['size'][0]}
for f in m['frames']:
    b=f['visibleBounds']; out['frames'][f['id']]={'atlas':'aed_atlas_'+f['asset'],'rect':f['rect'],'bounds':b,'pivot':f['anchor'],'bodyHeight':b[3]-b[1]}
    out['assets'].setdefault('aed_'+f['asset'],{'states':{}})['states'][f['state']]=f['id']
(ROOT/'aed-assets.js').write_text('window.AED_ART='+json.dumps(out,separators=(',',':'))+';\nfor(const k of ["atlases","assets","frames"])Object.assign(window.WORLD_ART[k],window.AED_ART[k]);\n',encoding='utf-8')
print('Indexed',len(out['atlases']),'PNGs /',len(out['frames']),'frames')
