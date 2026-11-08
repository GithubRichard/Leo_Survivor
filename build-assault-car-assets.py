"""Index the artist's unchanged RGBA sheets and manual registration metadata."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
BASE = ROOT / 'art/2d/armory-assault-car-v1'
read = lambda name: json.loads((BASE / name).read_text(encoding='utf-8-sig'))
m = read('manifest.json')
out = {'atlases': {}, 'assets': {}, 'frames': {}, 'rig': read('rig.json'),
       'clips': read('clips.json'), 'footprint': {'w': 2.2, 'h': 3.8},
       'groundOffset': {'x': 0, 'y': 1.2}}
for a in m['assets']:
    p = BASE / a['file']
    digest = hashlib.sha256(p.read_bytes()).hexdigest()
    with Image.open(p) as im:
        if digest != a['sha256'] or list(im.size) != a['size'] or im.mode != 'RGBA':
            raise ValueError(a['file'])
    out['atlases']['transport_atlas_' + a['id']] = {
        'src': p.relative_to(ROOT).as_posix() + '?v=' + digest[:16],
        'size': a['size'], 'crop': [0, 0, *a['size']],
        'lazy': True, 'parkingAtlas': True, 'maxWidth': a['size'][0]}
for f in m['frames']:
    x, y, w, h = f['rect']
    a = next(a for a in m['assets'] if a['id'] == f['asset'])
    if min(x, y) < 0 or min(w, h) <= 0 or x+w > a['size'][0] or y+h > a['size'][1]:
        raise ValueError(f['id'])
    b = f['visibleBounds']
    out['frames'][f['id']] = {'atlas': 'transport_atlas_' + f['asset'],
        'rect': f['rect'], 'bounds': b, 'pivot': f['anchor'],
        'bodyHeight': b[3]-b[1], 'pixelsPerMeter': f.get('pixelsPerMeter') or 90}
    out['assets'].setdefault('transport_' + f['asset'], {'states': {}})['states'][f['state']] = f['id']
(ROOT / 'assault-car-assets.js').write_text('window.ASSAULT_CAR_ART=' + json.dumps(out, separators=(',', ':')) +
    ';\nfor(const k of ["atlases","assets","frames"])Object.assign(window.WORLD_ART[k],window.ASSAULT_CAR_ART[k]);\n', encoding='utf-8')
print('Indexed', len(out['atlases']), 'unchanged RGBA sheets /', len(out['frames']), 'registered frames')
