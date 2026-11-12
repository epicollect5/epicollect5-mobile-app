"""Build public/assets/fonts/small-form-variants.woff2 for EC5.

One-off tool, run manually when the subset needs regenerating; not wired
into npm scripts or CI.

Source font (downloaded separately, NOT bundled in this repo):
  Noto Sans CJK SC Regular (OFL 1.1)
  https://github.com/notofonts/noto-cjk
  Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf

Requirements (run inside a venv):
  pip install fonttools brotli

Usage:
  python build-small-form-variants.py <source-otf> <output-woff2>

What it does:
- remaps U+FE64/U+FE65 to the family's own ASCII < > glyph outlines
  (the native small form variants render tiny with a fullwidth advance);
- normalizes vertical metrics to Latin-typical values so lines containing
  these glyphs do not change line-box height in mixed runs;
- subsets to exactly the two code points;
- renames the family (a Modified Version must not carry the source
  family name; the source declares no Reserved Font Names, this makes
  it explicit) while keeping the copyright/license records required
  for OFL redistribution.

Reproducibility: output is byte-stable across runs. The script re-execs
itself with PYTHONHASHSEED=0 because fontTools' woff2 encoder iterates
hash-ordered collections, which would otherwise vary per process.
"""
import os
import sys

# re-exec with a fixed hash seed (see "Reproducibility" above)
if os.environ.get('PYTHONHASHSEED') != '0':
    os.execve(sys.executable, [sys.executable] + sys.argv,
              dict(os.environ, PYTHONHASHSEED='0'))

from fontTools import subset
from fontTools.ttLib import TTFont

if len(sys.argv) != 3:
    print(__doc__)
    sys.exit(1)

SRC = sys.argv[1]
OUT = sys.argv[2]

FONT_FAMILY = 'EC5 Angle Brackets'
PS_NAME = 'EC5AngleBrackets'

# Latin-typical vertical metrics per 1000 upem (approximates Roboto/SF,
# keeps line boxes unchanged when these glyphs appear in a run)
ASCENT = 928
DESCENT = 244

font = TTFont(SRC)

# 1. remap FE64/FE65 to the ASCII < > outlines of the same family
for table in font['cmap'].tables:
    if table.isUnicode():
        if 0xFE64 in table.cmap:
            table.cmap[0xFE64] = 'cid00029'  # ASCII <
        if 0xFE65 in table.cmap:
            table.cmap[0xFE65] = 'cid00031'  # ASCII >

# 2. normalize vertical metrics (CJK fonts use tall metrics that would
# grow line boxes in mixed runs)
font['hhea'].ascent = ASCENT
font['hhea'].descent = -DESCENT
font['hhea'].lineGap = 0
os2 = font['OS/2']
os2.sTypoAscender = ASCENT
os2.sTypoDescender = -DESCENT
os2.sTypoLineGap = 0
os2.usWinAscent = ASCENT
os2.usWinDescent = DESCENT
# let engines agree on hhea/typo metrics (no USE_TYPO_METRICS ambiguity)
os2.fsSelection &= ~0x80

# 3. subset to exactly the two code points
options = subset.Options(flavor='woff2', drop_tables=['DSIG'])
# keep license records (13/14) alongside the usual set, for OFL redistribution
options.name_IDs = [0, 1, 2, 3, 4, 6, 13, 14, 16, 17]
ss = subset.Subsetter(options)
ss.populate(unicodes=[0xFE64, 0xFE65])
ss.subset(font)

# 4. rename family (OFL reserved names must not survive a modification);
# keep copyright (0), license (13) and license URL (14) records
name = font['name']
for rec in list(name.names):
    if rec.nameID in (1, 4, 16):
        name.setName(FONT_FAMILY, rec.nameID, rec.platformID, rec.platEncID, rec.langID)
    elif rec.nameID in (3, 6):
        name.setName(PS_NAME, rec.nameID, rec.platformID, rec.platEncID, rec.langID)
    elif rec.nameID in (7,):  # trademark of the source family: drop
        name.removeRecord(rec.nameID, rec.platformID, rec.platEncID, rec.langID)
    elif rec.nameID == 17:
        name.setName('Regular', rec.nameID, rec.platformID, rec.platEncID, rec.langID)

font.flavor = 'woff2'
font.save(OUT)
print('written', OUT)
