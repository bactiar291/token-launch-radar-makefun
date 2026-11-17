# SPDX-License-Identifier: MIT
"""Assemble actual verification artifacts without synthesizing test results."""
import hashlib,json,re
from pathlib import Path
repo=Path(__file__).resolve().parent.parent
a=repo.parent/'artifacts'
load=lambda n:json.loads((a/n).read_text())
browser=load('browser-test.json'); final=load('determinism.json'); gates=load('output-a-validation.json'); preview=load('preview-determinism.json')
metrics=load('research-metrics.json'); produced=load('output-a/research.json')
assert all(browser['checks'].values()) and gates['all_passed'] and final['identical_bytes']
assert {k:v for k,v in produced.items() if k!='input_sha256'}==metrics
for path,entry in preview['manifest'].items():
    assert final['manifest'][path]==entry,path
for entry in browser['screenshots']:
    assert final['manifest']['screenshots/'+Path(entry['path']).name]['sha256']==entry['sha256']
log=(a/'run-tests.log').read_text();assert '# tests 22' in log and '# pass 22' in log and '# fail 0' in log
source={str(p.relative_to(repo)):{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(repo.rglob('*')) if p.is_file() and '.git' not in p.parts and '__pycache__' not in p.parts}
assert source['vendor/makefun-board.ts']['sha256']=='9ca51b6e5cd84fe46cb0efa61e2ea99365a1fb0e21f2b75e6007f977f0dc326e'
report={'status':'local acceptance checks complete; ready for independent parent review','official_grade_claimed':False,'commands':[{'command':'/root/venv/bin/python3 tests/locked.py '+task,'exit_code':0,'log':'run-'+task+'.log'} for task in ['preview','browser','tests','determinism']]+[{'command':'/root/venv/bin/python3 tests/validate.py '+str(a/'output-a'),'exit_code':0,'result':'output-a-validation.json'}], 'node_runtime':'/tmp/makefun/runtime/node-v22.23.5-linux-x64/bin/node','node_tests':{'passed':22,'failed':0},'browser':browser,'gates':gates,'determinism':final,'preview_matches_final':True,'capture_hashes_match_final':True,'metrics_reproduce':True,'input_sha256':produced['input_sha256'],'metrics':{k:metrics[k] for k in ['selected','n','development_n','audit_n','development','heldout','residual','limitation']},'source_manifest':source,'changes_this_continuation':['Replaced four stale screenshots with real Playwright JPEG captures; obsolete fourth plan capture removed','Updated README acceptance results and official versus optional local limits','Added reproducible finish report assembler; model and UI implementation unchanged'], 'limits':{'official_dashboard_bytes':4194304,'optional_local_source_bytes':64000,'dossier_text_bytes':65536,'official_dossier_bytes':1572864,'official_image_bytes':524288,'image_guidance':'300–350 KB is guidance, not a minimum; real JPEG captures are smaller'},'model_semantics':{'audit_training':'All audit predictions train on development groups only; group isolation and audit-label mutation tests pass','deployment_fit':'Full-data refit includes all 89 eligible groups; separately labeled in method and README, not independently validated','legacy_test':'Ratio-only regression remains meaningful comparator coverage; research suite independently checks fitted predictions and all endpoints; browser baseline equals fitted export'},'unresolved_issues':['Independent human visual review not performed in this continuation; browser record retains visual_review=false','No official scorer, transcript gate or grade invoked; parent handles native transcript packaging, review, commit and publishing','Large 73.2172x empirical residual factor and snapshot-domain limitations remain; within-2x audit accuracy unchanged'], 'owned_resources':'Browser explicitly closed on successful run; loopback server shut down and closed in finally; no daemon launched','prohibited_actions_performed':False}
(a/'finish-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'report':str(a/'finish-report.json'),'checks':len(browser['checks']),'metrics_reproduce':True,'source_files':len(source),'all_seven_gates':gates['all_passed'],'outputs_identical':final['identical_bytes']},indent=2))
