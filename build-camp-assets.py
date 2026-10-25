"""Index the formal camp manifest. Never rewrite delivered PNGs or their metadata."""
import json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parent
BASE = ROOT / 'art/2d/camp-v1'
manifest = json.loads((BASE / 'manifest.json').read_text(encoding='utf-8-sig'))
clips = json.loads((BASE / 'clips.json').read_text(encoding='utf-8-sig'))
result = {'atlases': {}, 'assets': {}, 'frames': {}, 'clips': clips,
          'layers': json.loads((BASE / 'building-layers.json').read_text(encoding='utf-8-sig')),
          'offers': json.loads((BASE / 'offer-art-map.json').read_text(encoding='utf-8-sig')),
          'reuse': {}}
frames = {f['id']: f for f in manifest['frames']}
for asset in manifest['assets']:
    aid = 'camp_' + asset['id']
    key = 'world_atlas_' + aid
    path = (BASE / asset['file']).relative_to(ROOT).as_posix()
    size = asset.get('size') or list(Image.open(BASE / asset['file']).size)
    result['atlases'][key] = {'src': path + '?v=' + asset['sha256'][:16], 'size': size, 'crop': [0, 0, *size], 'lazy': True, 'parkingAtlas': True, 'maxWidth': 768}
    selected = [f for f in manifest['frames'] if f['asset'] == asset['id']]
    result['assets'][aid] = {'states': {f['state']: 'camp_' + f['id'] for f in selected}}
    for f in selected:
        ref = frames.get(f"{asset['id']}__{f['direction']}_idle", f) if asset['id'].startswith('npc_') else selected[0] if asset['id'] == 'doctor_treatment' else f
        b, rb = f['visibleBounds'], ref['visibleBounds']
        result['frames']['camp_' + f['id']] = {'atlas': key, 'rect': f['rect'], 'bounds': b,
            'pivot': f.get('suggestedFootPivot') or [(b[0]+b[2])/2, b[3]], 'bodyHeight': max(1, rb[3]-rb[1])}
for item in manifest['reuse']:
    aid = 'camp_reuse_' + item['id']
    key = 'world_atlas_' + aid
    image = Image.open(BASE / item['file'])
    size = list(image.size)
    result['atlases'][key] = {'src': (BASE / item['file']).relative_to(ROOT).as_posix()+'?v='+item['sha256'][:16], 'size': size, 'crop': [0,0,*size], 'lazy': True, 'parkingAtlas': True, 'maxWidth':768}
    supplied = item.get('frames') or []
    if supplied:
        frame = next((f for f in supplied if f['state'] == 'off'), supplied[0])
        rect, b = frame['rect'], frame['visibleBounds']
    else:
        rect = [0,0,*size]
        bounds = image.getchannel('A').getbbox() if image.mode == 'RGBA' else (0,0,*size)
        b = list(bounds or (0,0,*size))
    fid = aid+'__icon'
    result['assets'][aid] = {'states': {'icon': fid}}
    result['frames'][fid] = {'atlas':key,'rect':rect,'bounds':b,'pivot':[(b[0]+b[2])/2,b[3]],'bodyHeight':max(1,b[3]-b[1])}
    result['reuse'][item['id']] = aid
(ROOT/'camp-assets.js').write_text('/* Generated from formal camp-v1 metadata; source art unchanged. */\nwindow.CAMP_ART='+json.dumps(result,ensure_ascii=True,separators=(',',':'))+';\nfor(const key of ["atlases","assets","frames"])Object.assign(window.WORLD_ART[key],window.CAMP_ART[key]);\n',encoding='utf-8')
print(f"Indexed {len(manifest['assets'])} new atlases / {len(manifest['frames'])} delivered frames / {len(manifest['reuse'])} reused images")
