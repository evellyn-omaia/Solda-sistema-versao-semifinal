"""Authorized Pages administration. Credentials remain in memory and are never logged."""
import json, os, subprocess, sys, urllib.request, urllib.error
from pathlib import Path
root = Path(__file__).resolve().parent.parent
repo = 'evellyn-omaia/Solda-sistema-versao-semifinal'
env = dict(os.environ, GIT_TERMINAL_PROMPT='0', GCM_INTERACTIVE='never')
p = subprocess.run(['git','credential','fill'], input='protocol=https\nhost=github.com\n\n',capture_output=True,text=True,env=env,cwd=root)
credential = dict(line.split('=',1) for line in p.stdout.splitlines() if '=' in line)
token = credential.get('password')
if not token: raise SystemExit('No authorized GitHub credential available')
def api(path, method='GET', data=None):
    req = urllib.request.Request('https://api.github.com/repos/'+repo+path,
        data=json.dumps(data).encode() if data is not None else None, method=method,
        headers={'Authorization':'Bearer '+token,'User-Agent':'SoldaTech-release','Accept':'application/vnd.github+json','Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            body=response.read()
            return json.loads(body) if body else {'httpStatus':response.status}
    except urllib.error.HTTPError as error:
        raise SystemExit('GitHub API returned HTTP '+str(error.code)) from None
action=sys.argv[1]
if action=='configure':
    permissions=api('').get('permissions',{})
    if not permissions.get('admin') or not permissions.get('push'): raise SystemExit('Required access absent')
    api('/pages','PUT',{'build_type':'workflow'})
    d=api('/pages'); output={k:d.get(k) for k in ['html_url','build_type','source']}
elif action=='dispatch':
    output=api('/actions/workflows/pages.yml/dispatches','POST',{'ref':'main'})
elif action=='status':
    d=api('/actions/workflows/pages.yml/runs?per_page=5')
    output=[{k:r.get(k) for k in ['id','head_sha','status','conclusion','html_url']} for r in d.get('workflow_runs',[])]
else: raise SystemExit('Unknown action')
(root/'homologacao'/('github-'+action+'.json')).write_text(json.dumps(output,indent=2),encoding='utf-8')
print(json.dumps(output,indent=2))
