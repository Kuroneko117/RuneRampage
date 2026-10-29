"""Extend the existing OFL font subset for UI copy; full upstream font stays outside assets."""
from pathlib import Path
import argparse
import json
import sys

sys.path.insert(0, 'D:/CODEX缓存/rune-font-tools')
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib.instancer import instantiateVariableFont

parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True, help='Local full Noto Sans SC font; never packed')
parser.add_argument('--report', default='docs/one-hand-overload/font-audit.json')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
target = root / 'assets/resources/fonts/RuneSans.ttf'
current = TTFont(target)
glyphs = set(current.getBestCmap())
before = len(glyphs)
before_bytes = target.stat().st_size
for script in (root / 'assets/scripts').glob('*.ts'):
    glyphs.update(ord(c) for c in script.read_text(encoding='utf8') if '\u4e00' <= c <= '\u9fff')
current.close()
font = TTFont(args.source)
if 'fvar' in font:
    font = instantiateVariableFont(font, {'wght': 500}, inplace=True)
options = subset.Options()
options.name_IDs = ['*']
options.name_legacy = True
options.name_languages = ['*']
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=glyphs)
subsetter.subset(font)
names = {1: 'Rune Sans UI', 2: 'Medium', 3: 'RuneSansUI-500', 4: 'Rune Sans UI Medium',
         6: 'RuneSansUI-Medium', 16: 'Rune Sans UI', 17: 'Medium'}
for entry in font['name'].names:
    if entry.nameID in names:
        entry.string = names[entry.nameID].encode(entry.getEncoding(), errors='replace')
missing = glyphs - set(font.getBestCmap())
if missing:
    raise RuntimeError('Missing glyphs: ' + repr(sorted(missing)))
font.save(target)
output = root / args.report
output.parent.mkdir(parents=True, exist_ok=True)
report = dict(previousGlyphs=before, glyphs=len(font.getBestCmap()), beforeBytes=before_bytes,
              bytes=target.stat().st_size, missing=[], family='Rune Sans UI', license='SIL OFL-1.1')
output.write_text(json.dumps(report, indent=2), encoding='utf8')
print(json.dumps(report))
