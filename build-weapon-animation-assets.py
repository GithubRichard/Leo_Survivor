"""Build runtime metadata from delivered PNGs; never rewrite source images."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
ART = ROOT / 'art' / '2d' / 'player-armed-v1'
manifest = json.loads((ART / 'manifest.json').read_text(encoding='utf-8-sig'))
clips = json.loads((ART / 'clips.json').read_text(encoding='utf-8-sig'))
atlases = {}
images = {}
for atlas in manifest['atlases']:
    key = atlas['id']
    width, height = atlas['size']
    atlases[key] = {'src': f"art/2d/player-armed-v1/{atlas['file']}",
                    'size': [width, height], 'crop': [0, 0, width, height],
                    'lazy': True, 'weaponAtlas': True, 'maxWidth': 768}
    images[key] = Image.open(ART / atlas['file']).convert('RGBA')

frames = {}
for frame in manifest['frames']:
    sx, sy, width, height = frame['rect']
    torso_x, torso_y = frame['torso']
    bounds = frame['visibleBounds']
    pixels = images[frame['atlas']].load()
    foot = bounds[3]
    # Find a substantial dark shoe row, ignoring narrow tips and stray alpha.
    left = max(0, int(torso_x - width * .30))
    right = min(width, int(torso_x + width * .30))
    for y in range(min(height, bounds[3]) - 1, int(torso_y + (bounds[3] - torso_y) * .45), -1):
        count = 0
        for x in range(left, right):
            r, g, b, a = pixels[sx+x, sy+y]
            if a >= 160 and max(r, g, b) < 125 and max(r, g, b) - min(r, g, b) < 38:
                count += 1
        if count >= max(8, int(width * .05)):
            foot = min(height, y + 2)
            break
    # Torso registration holds the body steady without sizing to long weapons.
    body_height = max(height * .60, min(height * .98, (foot - torso_y) / .62))
    frames[frame['id']] = {'atlas': frame['atlas'], 'rect': frame['rect'],
                            'pivot': [round(torso_x, 2), foot],
                            'bodyHeight': round(body_height, 2)}

groups = {}
for clip in clips['clips']:
    groups.setdefault(clip['weapon'], {}).setdefault(clip['direction'], {})[clip['action']] = clip['frames']

data = {'atlases': atlases, 'frames': frames, 'clips': groups,
        'directions': ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast']}
(ROOT / 'weapon-animation-assets.js').write_text(
    '/* Generated from the final art manifest and clips; source PNGs unchanged. */\n'
    + 'window.WEAPON_ANIMATION = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n',
    encoding='utf-8')
print(f"Generated weapon-animation-assets.js: {len(atlases)} atlases, {len(frames)} frames, {len(clips['clips'])} clips")
