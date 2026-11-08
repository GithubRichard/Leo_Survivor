"""Read-only verification and registration of the artist's final 415-frame manifest."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
BASE = ROOT / 'art/2d/apocalypse-humans-v1'
m = json.loads((BASE / 'manifest.json').read_text(encoding='utf-8-sig'))
out = {'atlases': {}, 'assets': {}, 'frames': {}, 'lookup': {}, 'clips': m['clips']}
for a in m['assets']:
    p = BASE / a['file']
    digest = hashlib.sha256(p.read_bytes()).hexdigest()
    with Image.open(p) as im:
        assert digest == a['sha256'] and list(im.size) == a['size'] and im.mode == 'RGBA', a['id']
    out['atlases']['human_atlas_' + a['id']] = {'src': p.relative_to(ROOT).as_posix()+'?v='+digest[:16],
        'size': a['size'], 'crop': [0, 0, *a['size']], 'lazy': True, 'parkingAtlas': True,
        'maxWidth': min(a['size'][0], 1536)}
death_heights = {f['entity']: f['visibleBounds'][3]-f['visibleBounds'][1]
                 for f in m['frames'] if f['category'] == 'death' and f['action'] == 'hurt'}
for f in m['frames']:
    x, y, w, h = f['rect']; a = next(a for a in m['assets'] if a['id'] == f['asset'])
    assert min(x, y) >= 0 and min(w, h) > 0 and x+w <= a['size'][0] and y+h <= a['size'][1], f['id']
    b = f['visibleBounds']; body = f.get('bodyHeightPixels') or death_heights.get(f.get('entity'), b[3]-b[1])
    out['frames'][f['id']] = {'atlas': 'human_atlas_'+f['asset'], 'rect': f['rect'], 'bounds': b,
        'pivot': f['anchor'], 'bodyHeight': body}
    out['assets'].setdefault('humans_'+f['asset'], {'states': {}})['states'][f['state']] = f['id']
    if f.get('entity') and f.get('direction'):
        key = '|'.join([f['entity'], f['direction'], f['action']])
        assert key not in out['lookup'], key
        out['lookup'][key] = f['id']
assert len(out['atlases']) == 28 and len(out['frames']) == 415
(ROOT / 'humans-assets.js').write_text('window.HUMAN_ART='+json.dumps(out, separators=(',', ':'))+
    ';\nfor(const k of ["atlases","assets","frames"])Object.assign(window.WORLD_ART[k],window.HUMAN_ART[k]);\n', encoding='utf-8')
print('Verified 28 unchanged RGBA sheets and indexed 415 final frames')
