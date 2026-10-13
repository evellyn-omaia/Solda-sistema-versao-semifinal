"""Scan release sources without printing matched values; never authenticate to MQTT."""
import json, re, subprocess, hashlib
from pathlib import Path
root = Path(__file__).resolve().parent.parent
def git(*args):
    return subprocess.check_output(['git', *args], cwd=root).decode('utf-8', 'replace')
patterns = {
    'private-key': r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    'github-token': r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})',
    'service-account': r'"type"\s*:\s*"service_account"',
    'literal-secret': r'''(?i)\b(?:password|passwd|MQTT_PASS|MQTT_PASSWORD|adminToken|client_secret|access_token|refresh_token)\b["']?\s*[:=]\s*["']([^"'\r\n]{6,})["']''',
}
findings = []
files = sorted(set(git('ls-files', '--cached', '--others', '--exclude-standard').splitlines()))
for name in files:
    p = root / name
    if not p.is_file() or p.suffix.lower() not in ['.js','.mjs','.cjs','.py','.json','.md','.html','.yml','.yaml','.txt','.ps1']: continue
    body = p.read_text(encoding='utf-8', errors='replace')
    for kind, pattern in patterns.items():
        for match in re.finditer(pattern, body):
            findings.append({'file': name, 'line': body[:match.start()].count('\n') + 1, 'kind': kind})
manifest = [{'file':p.relative_to(root/'dist-pages').as_posix(), 'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted((root/'dist-pages').rglob('*')) if p.is_file()]
(root/'homologacao/security-scan-atual.json').write_text(json.dumps({'scope':'tracked and untracked nonignored text files; heuristic scan requires review','findings':findings},indent=2),encoding='utf-8')
(root/'homologacao/build-manifest-atual.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps({'findings':findings,'artifactFiles':len(manifest)},indent=2))
