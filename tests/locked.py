# SPDX-License-Identifier: MIT
"""Serialize owned verification work with the campaign's advisory flock."""
import fcntl, subprocess, sys
from pathlib import Path
repo=Path(__file__).resolve().parent.parent
commands={
 'tests':['/tmp/makefun/runtime/node-v22.23.5-linux-x64/bin/node','--test','tests/model.test.mjs','tests/plan.test.mjs','tests/research.test.mjs'],
 'preview':['/tmp/makefun/runtime/python/cpython-3.13-linux-x86_64-gnu/bin/python3.13','tests/determinism.py','--prepare'],
 'measure':['/tmp/makefun/runtime/node-v22.23.5-linux-x64/bin/node','tests/measure.mjs'],
 'browser':['/root/venv/bin/python3','tests/browser.py',str(repo.parent/'artifacts/preview-a')],
 'determinism':['/tmp/makefun/runtime/python/cpython-3.13-linux-x86_64-gnu/bin/python3.13','tests/determinism.py'],
}
with open('/tmp/makefun/campaign-20261117/verification.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 result=subprocess.run(commands[sys.argv[1]],cwd=repo,capture_output=True,text=True)
 (repo.parent/'artifacts'/('run-'+sys.argv[1]+'.log')).write_text(result.stdout+result.stderr)
 print(result.stdout+result.stderr,flush=True)
 raise SystemExit(result.returncode)
