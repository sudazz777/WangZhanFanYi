#!/usr/bin/env python3
"""Keep Tampermonkey update headers and embedded release information in sync."""
import json
from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
base = 'https://github.com/sudazz777/WangZhanFanYi'
raw = 'https://raw.githubusercontent.com/sudazz777/WangZhanFanYi/refs/heads/main'
for site in ['artlist', 'musicbed', 'github']:
    script = root / f'{site}-zh-CN.user.js'
    source = script.read_text()
    header = source[:source.index('// ==/UserScript==') + len('// ==/UserScript==')]
    def field(name):
        values = re.findall(r'^// @' + name + r'\s+([^\r\n]+)', header, re.M)
        if len(values) != 1:
            raise ValueError(f'{script.name}: expected one @{name}')
        return values[0].strip()
    version, name, namespace = field('version'), field('name'), field('namespace')
    if not re.fullmatch(r'\d{1,6}(?:\.\d{1,6}){1,3}', version):
        raise ValueError('Unsupported version format: ' + version)
    config = {
        'id': site, 'name': name, 'namespace': namespace, 'version': version,
        'metaUrl': f'{raw}/updates/{site}.meta.js',
        'downloadBase': f'{raw}/downloads/',
        'repoUrl': base + '#下载目录',
    }
    for key, value in [('updateURL', config['metaUrl']), ('downloadURL', f'{raw}/{script.name}')]:
        line = '// @' + key.ljust(13) + value
        if re.search(r'^// @' + key + r'\s+', source, re.M):
            source = re.sub(r'^// @' + key + r'\s+[^\r\n]+', line, source, count=1, flags=re.M)
        else:
            source = source.replace('// @run-at', line + '\n// @run-at', 1)
    for host in ['raw.githubusercontent.com']:
        if not re.search(r'^// @connect\s+' + re.escape(host) + r'\s*$', source, re.M):
            source = source.replace('// @license', '// @connect      ' + host + '\n// @license', 1)
    begin, end = '  // BEGIN SCRIPT UPDATE CONFIG', '  // END SCRIPT UPDATE CONFIG'
    payload = begin + '\n  const SCRIPT_UPDATE = ' + json.dumps(config, ensure_ascii=False, separators=(',', ':')) + ';\n' + end
    if begin in source:
        source = source[:source.index(begin)] + payload + source[source.index(end)+len(end):]
    else:
        source = source.replace("  const KEY =", payload + '\n\n  const KEY =', 1)
    begin, end = '  // BEGIN SCRIPT UPDATE MODULE', '  // END SCRIPT UPDATE MODULE'
    module = (root / 'scripts/script-update-module.js').read_text().rstrip()
    payload = begin + '\n' + module + '\n' + end
    if begin in source:
        source = source[:source.index(begin)] + payload + source[source.index(end)+len(end):]
    else:
        source = source.replace('  function panel()', payload + '\n\n  function panel()', 1)
    script.write_text(source)
    header = source[:source.index('// ==/UserScript==') + len('// ==/UserScript==')]
    target = root / f'updates/{site}.meta.js'
    target.parent.mkdir(exist_ok=True)
    target.write_text(header + '\n')
    print(f'{site}: v{version}, update metadata synchronized')
