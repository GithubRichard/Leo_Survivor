"""Encode the rendered WAV masters in audio/music to MP3 for the game and Docker image.

The WAV files remain the editable masters; the game only loads the MP3 files.
Requires ffmpeg with libmp3lame on PATH. LAME VBR quality 2 keeps the 24 kHz
stereo scores transparent (about 54-60 dB SNR against the WAV) at roughly
one tenth of the size.
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'audio/music'
QUALITY = '2'


def main():
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        sys.exit('encode-music: 找不到 ffmpeg，请先安装 ffmpeg 并加入 PATH，再运行 python encode-music.py')
    manifest_path = OUT / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    for track in manifest:
        source = OUT / f"{track['id']}.wav"
        target = OUT / f"{track['id']}.mp3"
        if not source.exists():
            sys.exit(f'encode-music: 缺少母带 {source.relative_to(ROOT).as_posix()}')
        subprocess.run([ffmpeg, '-v', 'error', '-y', '-i', str(source), '-c:a', 'libmp3lame', '-q:a', QUALITY, str(target)], check=True)
        track['file'] = target.relative_to(ROOT).as_posix()
        track['source'] = source.relative_to(ROOT).as_posix()
        track['bytes'] = target.stat().st_size
        print(f"{track['file']}: {source.stat().st_size // 1024}KB -> {track['bytes'] // 1024}KB")
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    total = sum(t['bytes'] for t in manifest)
    print(f'encode-music: {len(manifest)} 首，合计 {total / 1e6:.1f}MB')


if __name__ == '__main__':
    main()
