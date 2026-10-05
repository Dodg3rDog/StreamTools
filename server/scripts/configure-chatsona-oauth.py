#!/usr/bin/env python3
"""Run interactively on StreamTools; never paste the Discord client secret into chat."""
import getpass
import os
from pathlib import Path
import re
import subprocess
import time
root = Path(__file__).resolve().parents[2]
env = root / '.env'
secret = getpass.getpass('Discord OAuth client secret (hidden): ').strip()
if not re.fullmatch(r'[A-Za-z0-9_\-]{20,200}', secret):
    raise SystemExit('Secret format not recognized. No changes made.')
original = env.read_text()
backup = root / 'backups' / ('chatsona-oauth-' + str(time.time_ns()) + '.env')
backup.parent.mkdir(parents=True, exist_ok=True)
fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as f:
    f.write(original)
updated = original
for key, value in [('DISCORD_CLIENT_SECRET', secret), ('CHATSONA_PUBLIC_URL', 'https://bot.anthro-corp.com')]:
    line = key + '=' + value
    updated = re.sub(r'^'+key+r'=.*$', lambda _: line, updated, flags=re.M) if re.search(r'^'+key+r'=', updated, re.M) else updated+'\n'+line+'\n'
tmp = env.with_name('.env.chatsona.tmp')
fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, 'w') as f:
    f.write(updated)
os.chmod(tmp, 0o600)
os.replace(tmp, env)
print('Saved privately. Restarting StreamTools...')
subprocess.run(['node', '-e', "require('./node_modules/dotenv').config({path:'../.env',quiet:true});fetch('http://127.0.0.1:3030/api/server/restart',{method:'POST',headers:{Authorization:'Bearer '+process.env.BEARER_TOKEN}}).then(r=>{console.log('Restart response:',r.status);if(r.status!==202)process.exitCode=1;}).catch(()=>{console.error('Restart failed; restart streamtools-app manually.');process.exitCode=1;});"], cwd=root/'server', check=True)
