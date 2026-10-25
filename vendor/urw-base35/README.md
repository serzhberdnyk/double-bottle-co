# Nimbus source correspondence

The three OTF files in this directory are the exact inputs used to reproduce
the distributed Nimbus WOFF subsets. They were copied from the existing
`/usr/share/fonts/opentype/urw-base35/` installation for this source export.
The public font binaries and their embedded copyright notices are unchanged.

License and font exception: `../../public/fonts/LICENSE.txt`. That existing
file contains the complete AGPL text and the font exception and is retained
byte-for-byte. Its applicability is not extended to unrelated project code.

Source mapping and exact SHA256 values are in `SOURCES.json`. The names
`atlas-serif.woff` and `atlas-serif-bold.woff` are existing application aliases
for Nimbus Roman Regular and Bold, not claims that they are a different font.

Reproduce and compare without writing over any distributed font:

```sh
python3 scripts/subset-public-nimbus.py --check
```

Run that command from the project root. The recipe was verified with Python 3.12.14 and
fontTools 4.61.1. It has no catalog input and performs no network operations.
The character subset is U+0020..007E, U+0400..052F, U+2000..206F and U+0E3F.
This is the subset operation from `scripts/normalize-catalog.py`, factored out
without the unrelated private catalog migration. All three outputs were
reproduced byte-for-byte during this review.
