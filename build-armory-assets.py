"""Compile only declared delivery assets; green undead replaces every old Boss frame."""
import json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parent
out={'atlases':{},'assets':{},'frames':{},'anchors':{},'clips':[],'attachments':{}}
for folder in ['armory-v1','armory-undead-v2','thermal-weapons-v1']:
    base=ROOT/'art/2d'/folder
    read=lambda f:json.loads((base/f).read_text(encoding='utf-8-sig'))
    m=read('manifest.json')
    anchors={a['frame']:a for a in read('anchors.json').get('frames',[])}
    if (base/'anchor-overrides.json').exists():
        overrides=read('anchor-overrides.json')
        out.setdefault('anchorOverrides',{})[folder]=overrides
        for change in overrides.get('frames',[]):
            anchors.setdefault(change['frame'],{}).update(change)
    out['attachments'][folder]=read('equipment-attachments.json')
    out['clips'] += [c for c in read('clips.json')['clips'] if not(folder=='armory-v1' and c.get('entity')=='sweeper')]
    for a in m['assets']:
        if folder=='armory-v1' and a['id'].startswith('sweeper_') and a['id']!='sweeper_briefcase':continue
        aid='armory_'+a['id'];key='world_atlas_'+aid
        size=list(Image.open(base/a['file']).size)
        out['atlases'][key]={'src':(base/a['file']).relative_to(ROOT).as_posix()+'?v='+a['sha256'][:16],'size':size,'crop':[0,0,*size],'lazy':True,'parkingAtlas':True,'maxWidth':1536 if a['id'].startswith(('player_','sweeper_','blade_','armory_blade_')) else 768}
        fs=[f for f in m['frames'] if f['asset']==a['id']]
        idle=next((f for f in fs if f['state']=='idle'),None)
        out['assets'][aid]={'states':{f['state']:'armory_'+f['id'] for f in fs}}
        for f in fs:
            b=f['visibleBounds'];ref=(idle or f)['visibleBounds'];anchor=anchors.get(f['id'],{})
            out['frames']['armory_'+f['id']]={'atlas':key,'rect':f['rect'],'bounds':b,'pivot':anchor.get('foot',[(b[0]+b[2])/2,b[3]]),'bodyHeight':max(1,ref[3]-ref[1])}
            if anchor:out['anchors']['armory_'+f['id']]=anchor
out['layout']=json.loads((ROOT/'art/2d/armory-undead-v2/layout.json').read_text(encoding='utf-8-sig'))
for folder in ['armory-v1','armory-undead-v2','thermal-weapons-v1']:
    out.setdefault('events',{})[folder]=json.loads((ROOT/'art/2d'/folder/'animation-events.json').read_text(encoding='utf-8-sig'))
(ROOT/'armory-assets.js').write_text('/* Formal asset selection. No human sweeper fallback. */\nwindow.ARMORY_ART='+json.dumps(out,separators=(',',':'),ensure_ascii=True)+';\nfor(const k of ["atlases","assets","frames"])Object.assign(window.WORLD_ART[k],window.ARMORY_ART[k]);\n',encoding='utf-8')
print('Indexed',len(out['assets']),'assets and',len(out['frames']),'frames')
