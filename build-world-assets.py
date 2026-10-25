"""Compile formal delivery metadata without changing source PNGs."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parent
BASE = ROOT / 'art/2d/skeleton-boss-v1'
manifest = json.loads((BASE / 'manifest.json').read_text(encoding='utf-8-sig'))
frames = {f['id']: f for f in manifest['frames']}
result = {'atlases': {}, 'assets': {}, 'frames': {}}
for asset in manifest['assets']:
    aid = asset['id']
    key = 'world_atlas_' + aid
    path = (BASE / asset['file']).resolve().relative_to(ROOT).as_posix()
    result['atlases'][key] = {'src': path + '?v=' + asset['sha256'][:16], 'size': asset['size'], 'crop': [0, 0, *asset['size']], 'lazy': True, 'parkingAtlas': True, 'maxWidth': 768}
    selected = [f for f in manifest['frames'] if f['asset'] == aid]
    ref = frames[asset['bodyScaleReferenceFrame']]['visibleBounds']
    height = max(1, ref[3] - ref[1])
    result['assets'][aid] = {'states': {f['state']: f['id'] for f in selected}, 'entity': asset.get('entity'), 'direction': asset.get('direction')}
    for f in selected:
        b = f['visibleBounds']
        pivot = f.get('suggestedFootPivot') or [(b[0] + b[2]) / 2, b[3]]
        result['frames'][f['id']] = {'atlas': key, 'rect': f['rect'], 'bounds': b, 'pivot': pivot, 'bodyHeight': height}
(ROOT / 'world-assets.js').write_text('/* Generated formal delivery: source PNGs unchanged. */\nwindow.WORLD_ART=' + json.dumps(result, ensure_ascii=True, separators=(',', ':')) + ';\n', encoding='utf-8')
print(f"Indexed {len(result['atlases'])} atlases / {len(result['frames'])} frames")
