"""Reproduce the three distributed Nimbus WOFF subsets from bundled OTF sources.

No private catalog inputs, network access or production state are needed.
Requires Python 3 and fontTools 4.61.1. Default --check uses a temporary output
directory and never overwrites the distributed WOFFs. --output-dir explicitly
selects a separate destination for regenerated files.
"""
import argparse
import hashlib
import json
import tempfile
from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parents[1]
MAPPING = [
    ('NimbusSans-Regular.otf', 'nimbus-sans-regular.woff'),
    ('NimbusRoman-Regular.otf', 'atlas-serif.woff'),
    ('NimbusRoman-Bold.otf', 'atlas-serif-bold.woff'),
]


def regenerate(destination):
    destination.mkdir(parents=True, exist_ok=True)
    options = subset.Options()
    options.flavor = 'woff'
    results = []
    for source_name, output_name in MAPPING:
        source = ROOT / 'vendor/urw-base35' / source_name
        font = subset.load_font(str(source), options)
        selected = subset.Subsetter(options=options)
        selected.populate(unicodes=list(range(32, 127))
                          + list(range(0x400, 0x530))
                          + list(range(0x2000, 0x2070)) + [0x0E3F])
        selected.subset(font)
        output = destination / output_name
        subset.save_font(font, str(output), options)
        expected = ROOT / 'public/fonts' / output_name
        actual_bytes = output.read_bytes()
        results.append({
            'source': str(source.relative_to(ROOT)),
            'output': 'public/fonts/' + output_name,
            'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            'output_sha256': hashlib.sha256(actual_bytes).hexdigest(),
            'distributed_sha256': hashlib.sha256(expected.read_bytes()).hexdigest(),
            'byte_identical': actual_bytes == expected.read_bytes(),
        })
    return results


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Compare all outputs byte-for-byte; this is the default.')
    parser.add_argument('--output-dir', type=Path, help='Explicit separate destination; never use public/fonts.')
    args = parser.parse_args()
    if args.output_dir:
        if args.output_dir.resolve() == (ROOT / 'public/fonts').resolve():
            parser.error('Use a separate output directory; distributed font binaries are preserved.')
        results = regenerate(args.output_dir.resolve())
    else:
        with tempfile.TemporaryDirectory(prefix='nimbus-subset-') as temp:
            results = regenerate(Path(temp))
    print(json.dumps({'fonts': results, 'all_byte_identical': all(x['byte_identical'] for x in results)}, indent=2))
    raise SystemExit(0 if all(x['byte_identical'] for x in results) else 1)
