# SPDX-License-Identifier: MIT
import hashlib,json,subprocess,time,os
from pathlib import Path
repo=Path(__file__).resolve().parent.parent
input_path=os.environ.get('FIELD_SNAPSHOT','/tmp/makefun/campaign-20261117/kits/token-radar-01/verified/token-radar-01-kit/input/snapshot.json')
artifacts=repo.parent/'artifacts'
prepare='--prepare' in __import__('sys').argv
outputs=[artifacts/('preview-'+x if prepare else 'output-'+x) for x in ['a','b']]
runs=[]
for out in outputs:
    start=time.monotonic()
    run=subprocess.run([os.environ.get('FIELD_NODE','/tmp/makefun/runtime/node-v22.23.5-linux-x64/bin/node'),'main.ts','--input',input_path,'--output',str(out)]+(['--prepare'] if prepare else []),cwd=repo,env={'PATH':'/usr/bin:/bin'},capture_output=True,text=True)
    assert run.returncode==0,run.stderr
    runs.append({'output':str(out),'elapsed_seconds':round(time.monotonic()-start,4),'stdout':json.loads(run.stdout)})
def manifest(root):
    return {str(p.relative_to(root)):{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(root.rglob('*')) if p.is_file()}
a,b=map(manifest,outputs);assert a==b,'Output manifests differ'
for rel in a:assert (outputs[0]/rel).read_bytes()==(outputs[1]/rel).read_bytes(),rel
result={'identical_bytes':True,'file_count':len(a),'runs':runs,'manifest':a}
(artifacts/('preview-determinism.json' if prepare else 'determinism.json')).write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
