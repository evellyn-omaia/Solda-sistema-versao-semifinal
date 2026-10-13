"""Compare deployed HTTPS files with the reviewed local artifact, without logging content."""
import hashlib, json, re, urllib.request, urllib.error
from urllib.parse import quote
from pathlib import Path
from datetime import datetime, timezone
root=Path(__file__).resolve().parent.parent
base='https://evellyn-omaia.github.io/Solda-sistema-versao-semifinal/'
result={'checkedAt':datetime.now(timezone.utc).isoformat(),'base':base,'files':[],'privatePaths':[]}
def fetch(name):
    try:
        with urllib.request.urlopen(urllib.request.Request(base+quote(name),headers={'Cache-Control':'no-cache'}),timeout=30) as response:
            return response.status,response.read()
    except urllib.error.HTTPError as error: return error.code,b''
for item in json.loads((root/'homologacao/build-manifest-atual.json').read_text()):
    status,body=fetch(item['file'])
    entry={'file':item['file'],'status':status,'hashMatches':hashlib.sha256(body).hexdigest()==item['sha256']}
    if item['file'].endswith(('.js','.mjs','.html','.json','.svg')):
        text=body.decode('utf-8','replace')
        entry['secretOrIndustrialIndicator']=bool(re.search(r'''hivemq|-----BEGIN .*PRIVATE KEY|\bpassword\s*[:=]\s*["'][^"']+["']|github_pat_''',text,re.I))
    result['files'].append(entry)
for name in ['node-red/flows.json','mqtt-broker/server.js','database-rules.json','.env','.soldatech/runtime.json','scripts/github-release.py']:
    status,_=fetch(name);result['privatePaths'].append({'file':name,'status':status})
result['passed']=all(f['status']==200 and f['hashMatches'] and not f.get('secretOrIndustrialIndicator') for f in result['files']) and all(f['status']==404 for f in result['privatePaths'])
(root/'homologacao/published-verification-atual.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({'passed':result['passed'],'checkedFiles':len(result['files']),'failures':[f for f in result['files'] if f['status']!=200 or not f['hashMatches'] or f.get('secretOrIndustrialIndicator')],'privatePaths':result['privatePaths']},indent=2))
raise SystemExit(0 if result['passed'] else 1)
