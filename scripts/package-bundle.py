#!/usr/bin/env python3
"""Package the generated userscript as the single public ZIP download."""
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
release = json.loads((root / 'scripts/bundle-config.json').read_text())
target = root / f"downloads/{release['id']}-translation-v{release['version']}.zip"
script = root / release['filename']
instructions = root / 'docs/合并版-安装说明.txt'
assert f"网站翻译 v{release['version']}" in instructions.read_text()
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
    for source, name in [(script, script.name), (instructions, '安装说明.txt'),
                         (root / 'licenses/GPL-3.0.txt', 'GPL-3.0.txt')]:
        info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, source.read_bytes())
with zipfile.ZipFile(target) as archive:
    assert archive.read(script.name) == script.read_bytes()
print(f'Packaged {target.name} ({target.stat().st_size:,} bytes)')
