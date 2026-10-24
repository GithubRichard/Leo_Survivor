"""Compile the final parking delivery into runtime metadata; never edit art files."""
import hashlib
import json
from pathlib import Path
from urllib.parse import quote
from PIL import Image

ROOT = Path(__file__).resolve().parent
ART = ROOT / 'art' / '2d' / 'parking-boss-v1'
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
manifest = read(ART / 'manifest.json')
clip_data = read(ART / 'clips.json')
bindings = read(ART / 'art-bindings.json')
mask_data = read(ART / 'masks' / 'manifest.json')
revision = hashlib.sha256(Path(__file__).read_bytes() + b''.join((ART / name).read_bytes() for name in
    ['manifest.json', 'clips.json', 'art-bindings.json', 'masks/manifest.json'])).hexdigest()[:16]
delivered = {f['id']: f for f in manifest['frames']}
atlases, frames, assets, characters = {}, {}, {}, {}
carried_players = {'player_lights', 'player_lights_off', 'player_headlamp'}


def player_head(crop, bounds):
    """Find the dark hair mass, excluding the flame, hands and moving boots."""
    l, t, r, b = bounds
    height = b-t
    bottom = min(b, round(t+height*.42))
    pixels = crop.load()
    dark = set()
    for y in range(t, bottom):
        for x in range(l, r):
            red, green, blue, alpha = pixels[x, y]
            if alpha >= 160 and max(red, green, blue) < 135 and max(red, green, blue)-min(red, green, blue) < 32:
                dark.add((x, y))
    candidates = []
    while dark:
        start = dark.pop()
        queue = [start]
        left = right = start[0]
        top = base = start[1]
        for x, y in queue:
            left, right, top, base = min(left, x), max(right, x), min(top, y), max(base, y)
            for point in ((x-1, y), (x+1, y), (x, y-1), (x, y+1)):
                if point in dark:
                    dark.remove(point)
                    queue.append(point)
        width, tall = right-left+1, base-top+1
        if top <= t+height*.25 and (top+base)/2 <= t+height*.30 and width >= height*.10 and tall >= height*.07 and len(queue) >= height*height*.003:
            candidates.append((len(queue), [(left+right)/2, top, base+1]))
    return max(candidates, key=lambda item: item[0])[1] if candidates else None


for job in manifest['assets']:
    file = ART / job['file']
    source_hash = hashlib.sha256(file.read_bytes()).hexdigest()
    if source_hash != job['sha256']:
        raise ValueError(f"Source changed since delivery: {job['id']}")
    with Image.open(file) as source:
        im = source.convert('RGBA')
    width, height = im.size
    atlas = 'parking_atlas_' + job['id']
    atlases[atlas] = {'src': 'art/2d/parking-boss-v1/' + job['file'] + '?v=' + source_hash[:16],
        'size': [width, height], 'crop': [0, 0, width, height], 'lazy': True,
        'parkingAtlas': True, 'maxWidth': 640 if job.get('entity') else 768}
    group = {'label': job['label'], 'states': {}, 'entity': job.get('entity'),
        'direction': job.get('direction'), 'phase': job.get('phase'), 'sha256': source_hash}
    for state in job['states']:
        frame_id = job['id'] + '__' + state['id']
        meta = delivered[frame_id]
        sx, sy, w, h = meta['rect']
        if w <= 0 or h <= 0 or sx < 0 or sy < 0 or sx+w > width or sy+h > height:
            raise ValueError(f'Invalid delivered rect: {frame_id}')
        crop = im.crop((sx, sy, sx+w, sy+h))
        solid = crop.getchannel('A').point(lambda a: 255 if a >= 160 else 0)
        bounds = solid.getbbox() or crop.getchannel('A').getbbox()
        if not bounds:
            raise ValueError(f'Empty delivered frame: {frame_id}')
        l, t, r, b = bounds
        pivot_x, foot, body_top = (l+r)/2, b, t
        if job.get('entity') and state['id'] != 'dead':
            pixels = crop.load()
            left, right = max(0, round(pivot_x-w*.2)), min(w, round(pivot_x+w*.2))
            for y in range(b-1, round(t+(b-t)*.65), -1):
                toes = [x for x in range(left, right) if pixels[x, y][3] >= 160 and max(pixels[x, y][:3]) < 135]
                if len(toes) >= max(5, round(w*.025)):
                    foot, pivot_x = min(h, y+2), sum(toes)/len(toes)
                    break
            band = solid.crop((max(0, round(pivot_x-w*.1)), t, min(w, round(pivot_x+w*.1)), foot))
            head = band.getbbox()
            if head:
                body_top = t+head[1]
        if job['id'] == 'parking_entrance':
            pivot_x, foot = width*.32, height*.865
        elif job['id'] == 'underground_exit':
            pivot_x, foot = width*.33, height*.84
        elif job['id'] in ('civilian_car', 'maintenance_van', 'supply_van', 'security_car'):
            foot = b-(b-t)*.17
        frames[frame_id] = {'atlas': atlas, 'rect': meta['rect'], 'bounds': list(bounds),
            'pivot': [round(pivot_x, 2), round(foot, 2)],
            'head': [round(pivot_x, 2), round(body_top+(foot-body_top)*.15, 2)],
            'bodyHeight': max(1, foot-body_top) if job.get('entity') else max(1, b-t),
            'state': state['id'], 'action': meta.get('action'), 'frame': meta.get('frame')}
        if job.get('entity') in carried_players or job.get('entity') == 'player_stealth':
            head = player_head(crop, bounds)
            if head:
                frames[frame_id]['registration'] = {'head': head, 'ground': b}
        group['states'][state['id']] = frame_id
    reference = group['states'].get('idle') or group['states'].get('off') or next(iter(group['states'].values()))
    for frame_id in group['states'].values():
        frames[frame_id]['bodyHeight'] = frames[reference]['bodyHeight']
    if job.get('entity') in carried_players:
        for state, frame_id in group['states'].items():
            frame = frames[frame_id]
            anchor = frame.get('registration')
            if not anchor:
                continue
            # Each carried item has its own idle height. Register horizontally
            # from the head, keeping the boots on the ground and natural gait bob.
            prefix = state.split('_')[0]
            idle = frames[group['states'].get(prefix+'_idle') or group['states'].get('idle') or reference]
            baseline = idle.get('registration')
            height = baseline['ground']-baseline['head'][1] if baseline else idle['bodyHeight']
            x, top, bottom = anchor['head']
            frame['bodyHeight'] = max(1, height)
            frame['pivot'] = [round(x, 2), anchor['ground']]
            frame['head'] = [round(x, 2), round(top+(bottom-top)*.7, 2)]
    elif job.get('entity') == 'player_stealth':
        # Crouch poses have different native heights. The old toe-centred band
        # sometimes started below the head, magnifying left/right directions.
        # Use each pose's complete body bounds for a consistent screen height.
        for frame_id in group['states'].values():
            frame = frames[frame_id]
            l, top, r, bottom = frame['bounds']
            anchor = frame.get('registration')
            x = anchor['head'][0] if anchor else (l+r)/2
            frame['bodyHeight'] = max(1, bottom-top)
            frame['pivot'] = [round(x, 2), bottom]
            frame['head'] = [round(x, 2), round(anchor['head'][1]+(anchor['head'][2]-anchor['head'][1])*.7, 2) if anchor else round(top+(bottom-top)*.15, 2)]
    assets[job['id']] = group
    if job.get('entity') and job.get('direction'):
        characters.setdefault(job['entity'], {}).setdefault(job.get('phase') or 'default', {})[job['direction']] = job['id']

clips = {c['id']: c for c in clip_data['clips']}
for clip in clips.values():
    for frame_id in clip['frames']:
        if frame_id not in frames:
            raise ValueError(f'Missing clip frame: {frame_id}')
masks = {}
for mask in mask_data['assets']:
    name = Path(mask['file']).stem
    masks[name] = {'src': 'data:image/svg+xml,' + quote((ART / 'masks' / mask['file']).read_text(encoding='utf-8')),
        'source': 'art/2d/parking-boss-v1/masks/' + mask['file'],
        'size': [1024, 1024], 'crop': [0, 0, 1024, 1024], 'lazy': True, 'parkingAtlas': True, 'maxWidth': 512}
aliases = {'torch': ['torch', 'off'], 'oil_lantern': ['fuel_lantern', 'off'],
    'flashlight': ['flashlight', 'off'], 'headlamp': ['headlamp', 'off'],
    'fuel_oil': ['car_fuel', 'default'], 'battery': ['battery', 'default'],
    'wire': ['wire', 'default'], 'fuse': ['fuse', 'default'],
    'fixed_oil_lamp': ['fixed_fuel_light', 'off'], 'generator_light': ['generator_light', 'off']}
data = {'schema': 2, 'revision': revision, 'atlases': atlases, 'frames': frames, 'assets': assets,
    'characters': characters, 'clips': clips, 'masks': masks, 'bindings': bindings, 'aliases': aliases,
    'coverage': {'availableAtlases': len(atlases), 'plannedAtlases': manifest['expectedPNGs'],
        'availableFrames': len(frames), 'plannedFrames': manifest['expectedFrames'], 'clips': len(clips), 'masks': len(masks), 'missing': []}}
(ROOT / 'parking-assets.js').write_text('/* Final delivery metadata; source PNGs unchanged. */\nwindow.PARKING_ART = '
    + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
report = ['# 停车场模型接入清单', '',
    f'最终交付索引：{len(atlases)}/{manifest["expectedPNGs"]}张图集，{len(frames)}/{manifest["expectedFrames"]}帧，{len(clips)}组动作，{len(masks)}张范围SVG。',
    '', f'资源版本：{revision}。', '',
    '严格使用最终manifest.json的rect，来源SHA256不匹配、空帧或缺少帧序时停止生成，保留先前索引。PNG、SVG和美术交付文件均不修改。',
    '', '显形Boss两阶段、砸灯者、玩家亮灯/关灯携带、头灯和潜伏动作均使用屏幕八方向；移动顺序来自clips.json，按实际位移播放。投灯释放图双手空，不重复画武器或手中灯。',
    '', '携灯玩家以头部中心标定横向根点、鞋底接地，以对应持灯站姿统一身体比例，不再随最低脚尖左右跳动；保留迈步起伏，火焰不参与人物高度。',
    '', '玩家潜伏的56帧分别按完整人体边界标定高度，八方向潜伏待机与移动保持同一屏幕高度，结束姿势恢复正常站立高度。',
    '', '人物脚点和世界比例在运行索引标定；美术完整交付不代表玩法或实机验收已通过。自动检测保持关闭。', '', '## 已索引图集', '']
report += [f'- {k}：{v["label"]}，{len(v["states"])}帧。' for k, v in assets.items()]
report += ['', '## 缺少的交付图集', '', '无。', '', '## 运行范围', '',
    '保留版本1存档、场景冻结时间、全部规则数值及键盘/触屏操作。下一层仅显示解锁入口。',
    '仅做语法检查与静态复核，未运行游戏、测试或试玩；脚点、遮挡和实际观感仍需后续试玩确认。']
(ROOT / '停车场素材接入清单.md').write_text('\n'.join(report)+'\n', encoding='utf-8')
print(f'Generated final parking index: {len(atlases)} atlases, {len(frames)} frames, {len(clips)} clips, {len(masks)} masks; revision {revision}.')
