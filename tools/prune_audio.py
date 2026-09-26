"""Delete audio files in public/audio that no content JSON references any more (after editing items).
    python tools/prune_audio.py [--dry-run]"""
import glob
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(__file__), '..')
refs = set()
for f in glob.glob(os.path.join(ROOT, 'public/content/**/*.json'), recursive=True):
    with open(f, encoding='utf-8') as fh:
        refs |= set(re.findall(r'"f":\s*"([0-9a-f]{8,})"', fh.read()))
orphans = [f for f in glob.glob(os.path.join(ROOT, 'public/audio/*')) if os.path.basename(f).split('.')[0] not in refs]
for f in orphans:
    if '--dry-run' not in sys.argv:
        os.remove(f)
print(f'{len(refs)} referenced, {len(orphans)} orphan files {"found" if "--dry-run" in sys.argv else "removed"}')
