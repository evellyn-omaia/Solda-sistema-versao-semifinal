"""Read-only release audit. Never emit credentials or response bodies."""
import subprocess, json, re, urllib.request, urllib.error, os
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)
def git(*args):
    return subprocess.check_output(['git', *args], text=True, encoding='utf-8', errors='replace')
def fetch(url, token=None):
    headers = {'User-Agent': 'SoldaTech-release-audit'}
    if token: headers['Authorization'] = 'Bearer ' + token
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=25) as r:
            return r.status, r.read().decode('utf-8', errors='replace')
    except urllib.error.HTTPError as e: return e.code, ''
    except Exception: return 'NETWORK_ERROR', ''
from datetime import datetime, timezone
result = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'branches': {}, 'credentialLocations': [], 'remote': []}
pages_url = None
for branch in ['origin/main', 'main', 'backup-visao-computacional', 'HEAD']:
    result['branches'][branch] = git('rev-parse', branch).strip()
for branch in ['origin/main', 'main', 'backup-visao-computacional']:
    for file in git('ls-tree', '-r', '--name-only', branch).splitlines():
        if not file.endswith(('.js','.json','.py','.html','.md')): continue
        body = git('show', branch + ':' + file)
        for n, line in enumerate(body.splitlines(), 1):
            kinds = []
            if re.search(r'hivemq', line, re.I): kinds.append('HiveMQ reference')
            if re.search(r'\b(?:password|username|MQTT_PASSWORD|MQTT_USER)\s*[:=]\s*[\"\'][^\"\']+[\"\']', line, re.I): kinds.append('literal credential candidate')
            if kinds: result['credentialLocations'].append({'ref':branch,'file':file,'line':n,'indicators':kinds})
env = dict(os.environ, GIT_TERMINAL_PROMPT='0', GCM_INTERACTIVE='never')
p = subprocess.run(['git','credential','fill'], input='protocol=https\nhost=github.com\n\n', capture_output=True, text=True, env=env)
credential = dict(line.split('=',1) for line in p.stdout.splitlines() if '=' in line)
token = credential.get('password')
base = 'https://api.github.com/repos/esterv-dev/Solda-sistema-versao-semifinal'
for suffix in ['', '/pages', '/actions/workflows']:
    status, body = fetch(base + suffix, token)
    entry = {'path':suffix or '/', 'status':status}
    if status == 200:
        data=json.loads(body)
        if suffix == '/pages': pages_url = data.get('html_url')
        for key in ['permissions','default_branch','build_type','source','html_url','total_count']:
            if key in data: entry[key]=data[key]
    result['remote'].append(entry)
base = pages_url or 'https://esterv-dev.github.io/Solda-sistema-versao-semifinal/'
for file in ['', 'new-program/camera.html','new-program/simulacao-integrada.mjs','new-program/visao-camera.mjs','new-program/mqtt-maquina.js']:
    status, body=fetch(base+file)
    result['remote'].append({'path':file or 'index','status':status,'hivemq':bool(re.search('hivemq',body,re.I)), 'literalPassword':bool(re.search(r'\bpassword\s*:\s*[\"\'][^\"\']+[\"\']',body))})
Path('homologacao/retomada-remoto.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
