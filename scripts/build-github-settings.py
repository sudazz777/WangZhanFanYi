#!/usr/bin/env python3
"""Build the offline settings dictionary from a pinned github-chinese locals.js.

Only literal static translations and explicit dictionary references are read.
The upstream JavaScript and regular expressions are never executed.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=Path)
parser.add_argument('--commit', required=True)
args = parser.parse_args()
if not re.fullmatch(r'[a-f0-9]{40}', args.commit):
    parser.error('--commit must be a full Git commit SHA')
source_bytes = args.source.read_bytes()
source = source_bytes.decode('utf-8')
assignment = re.compile(r'^I18N\["zh-CN"\]\["([^"\n]+)"\]\s*=\s*', re.M)
matches = list(assignment.finditer(source))
literal_pair = re.compile(r'^\s*("(?:[^"\\]|\\.)*")\s*:\s*("(?:[^"\\]|\\.)*")\s*[,}]?', re.M)
reference = re.compile(r'I18N\["zh-CN"\]\["([^"\n]+)"\](?:\["static"\])?')
sections = {}
def decode_literal(value):
    def escape(match):
        token = match[0][1:]
        if token.startswith('x') and len(token) == 3:
            return '\\u00' + token[1:]
        if token == 'v':
            return '\\u000b'
        if token == '0':
            return '\\u0000'
        if token[0] in '"\\/bfnrtu':
            return match[0]
        return token
    return json.loads(re.sub(r'\\(?:u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)', escape, value))

for i, match in enumerate(matches):
    body = source[match.end():matches[i+1].start() if i+1 < len(matches) else len(source)]
    if body.lstrip().startswith('I18N['):
        refs = reference.findall(body.split(';', 1)[0])
        sections[match[1]] = {'include': refs, 'words': {}}
        continue
    start = re.search(r'^\s{4}"static"\s*:\s*\{', body, re.M)
    if not start:
        continue
    body = re.split(r'^\s{4}"regexp"\s*:', body[start.end():], maxsplit=1, flags=re.M)[0]
    words = {}
    for pair in literal_pair.finditer(body):
        key, value = (decode_literal(s) for s in pair.groups())
        if key and value and re.search(r'[\u3400-\u9fff]', value):
            words[key] = value
    refs = re.findall(r'^\s*\.\.\.I18N\["zh-CN"\]\["([^"\n]+)"\]\["static"\]', body, re.M)
    sections[match[1]] = {'include': list(dict.fromkeys(refs)), 'words': words}

selected = {key for key in sections if key.startswith(('repository/settings', 'settings', 'orgs/settings'))}
selected.update({'public', 'repository-settings-menu', 'settings-menu', 'orgs-settings-menu'})
pending = list(selected)
while pending:
    key = pending.pop()
    if key not in sections:
        raise ValueError('Unresolved dictionary reference: ' + key)
    for dependency in sections[key]['include']:
        if dependency not in selected:
            selected.add(dependency)
            pending.append(dependency)
data = {key: sections[key] for key in sorted(selected)}
root = Path(__file__).resolve().parent.parent
target = root / 'github-zh-CN.user.js'
script = target.read_text()
begin = '  // BEGIN GENERATED SETTINGS DICTIONARY'
end = '  // END GENERATED SETTINGS DICTIONARY'
payload = begin + '\n  const SETTINGS_DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n' + end
if begin in script:
    script = script[:script.index(begin)] + payload + script[script.index(end)+len(end):]
else:
    script = script.replace('  const WORDS = new Map();', payload + '\n\n  const WORDS = new Map();', 1)
target.write_text(script)
provenance = {
    'project': 'https://github.com/maboloshi/github-chinese',
    'commit': args.commit,
    'source': f'https://github.com/maboloshi/github-chinese/blob/{args.commit}/locals.js',
    'sha256': hashlib.sha256(source_bytes).hexdigest(),
    'license': 'GPL-3.0-or-later',
    'groups': len(data),
    'literal_entries': sum(len(group['words']) for group in data.values()),
    'scope': 'Static settings dictionaries and their literal dependencies; no upstream code or regex execution',
}
(root / 'docs/github-settings-source.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2)+'\n')
print(json.dumps(provenance, ensure_ascii=False, indent=2))
