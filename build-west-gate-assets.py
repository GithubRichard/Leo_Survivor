"""Index the declared west-gate delivery without changing any source PNG."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
BASE = ROOT / 'art/2d/west-gate-v1'
read = lambda name: json.loads((BASE / name).read_text(encoding='utf-8-sig'))
manifest = read('manifest.json')
anchors = {a['frame']: a for a in read('anchors.json')['anchors']}
declared = {a['id']: a for a in manifest['assets']}
by_file = {a['file']: a for a in manifest['assets']}
out = {'atlases': {}, 'assets': {}, 'frames': {}, 'rig': read('world-rig.json'), 'clips': read('clips.json')}
images = {}
for asset in manifest['assets']:
    path = BASE / asset['file']
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != asset['sha256']:
        raise ValueError('Source hash mismatch: ' + asset['file'])
    im = images[asset['id']] = Image.open(path).convert('RGBA')
    key = 'west_atlas_' + asset['id']
    out['atlases'][key] = {'src': path.relative_to(ROOT).as_posix() + '?v=' + digest[:16], 'size': list(im.size), 'crop': [0, 0, *im.size], 'lazy': True, 'parkingAtlas': True, 'maxWidth': 1536}

for frame in manifest['frames']:
    source = declared[frame.get('imageAsset') or frame['asset']]
    if frame['file'] != source['file']:
        source = by_file[frame['file']]
    im = images[source['id']]
    x, y, w, h = frame['rect']
    if min(x, y) < 0 or min(w, h) <= 0 or x + w > im.width or y + h > im.height:
        raise ValueError('Invalid rect: ' + frame['id'])
    bounds = frame['visibleBounds']
    pivot = anchors[frame['id']]['sourceRectLocalPixels']
    data = {'atlas': 'west_atlas_' + source['id'], 'rect': frame['rect'], 'bounds': bounds, 'pivot': pivot, 'bodyHeight': max(1, bounds[3] - bounds[1])}
    if 'west_gate_leaf_' in frame['asset']:
        # Measure floor-edge pixels in alpha, not hidden RGB; logical hinges stay in the rig.
        alpha = im.crop((x, y, x + w, y + h)).getchannel('A')
        px, py = pivot
        rightward = bounds[2] - px >= px - bounds[0]
        columns = range(max(0, bounds[2] - 10), min(w, bounds[2])) if rightward else range(max(0, bounds[0]), min(w, bounds[0] + 10))
        pixels = [(cx, cy) for cx in columns for cy in range(max(0, bounds[1]), min(h, bounds[3])) if alpha.getpixel((cx, cy)) > 16]
        tip_y = max(cy for cx, cy in pixels)
        tip_x = sum(cx for cx, cy in pixels if cy == tip_y) / sum(1 for cx, cy in pixels if cy == tip_y)
        hinge_top = min(cy for cx in range(max(0, px - 3), min(w, px + 4)) for cy in range(max(0, bounds[1]), min(h, bounds[3])) if alpha.getpixel((cx, cy)) > 16)
        data['surfacePoints'] = [pivot, [tip_x, tip_y], [px, hinge_top]]
    fid = 'west_' + frame['id']
    out['frames'][fid] = data
    out['assets'].setdefault('west_' + frame['asset'], {'states': {}})['states'][frame['state']] = fid

(ROOT / 'west-gate-assets.js').write_text('/* Final manifest files, actual rects, RGBA and per-frame source aliases. */\nwindow.WEST_GATE_ART=' + json.dumps(out, separators=(',', ':'), ensure_ascii=True) + ';\nfor(const k of ["atlases","assets","frames"])Object.assign(window.WORLD_ART[k],window.WEST_GATE_ART[k]);\n', encoding='utf-8')
print(f"Indexed {len(out['atlases'])} gate PNGs / {len(out['frames'])} frames")
