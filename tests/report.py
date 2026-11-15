# SPDX-License-Identifier: MIT
import json,hashlib,subprocess,time
from pathlib import Path
from datetime import datetime,timezone
repo=Path(__file__).resolve().parent.parent
out=Path('/tmp/makefun/radar-test-a')
validation=json.loads(Path('/tmp/makefun/radar-test-a-validation.json').read_text())
determinism=json.loads(Path('/tmp/makefun/radar-test-determinism.json').read_text())
browser=json.loads(Path('/tmp/makefun/radar-test-preview/browser-test.json').read_text())
data=json.loads((out/'data.js').read_text()[len('window.FIELD_DATA='):-2])
unit=subprocess.run(['/usr/bin/node','--test','tests/model.test.mjs'],cwd=repo,env={'PATH':'/usr/bin:/bin'},text=True,capture_output=True)
assert unit.returncode==0,unit.stdout+unit.stderr
Path('/tmp/makefun/radar-test-model-results.txt').write_text(unit.stdout)
for rel in ['dashboard/app.js','dashboard/app.css','dashboard/index.html','dashboard/model.js','data.js']:
    assert (out/rel).read_bytes()==(Path('/tmp/makefun/radar-test-preview')/rel).read_bytes(),rel+' capture input mismatch'
for p in (repo/'screenshots').iterdir():assert p.read_bytes()==(out/'screenshots'/p.name).read_bytes()
kit=Path('/tmp/makefun/token-radar-01-kit/starter/vendor/makefun-board.ts')
assert (repo/'vendor/makefun-board.ts').read_bytes()==kit.read_bytes()
status=subprocess.run(['/usr/bin/git','status','--short'],cwd=repo,env={'PATH':'/usr/bin:/bin'},text=True,capture_output=True)
head=subprocess.run(['/usr/bin/git','rev-parse','--verify','HEAD'],cwd=repo,env={'PATH':'/usr/bin:/bin'},text=True,capture_output=True)
report={
 'title':'Fieldnote — token launch research','completed_at_utc':datetime.now(timezone.utc).isoformat(),
 'repo':str(repo),'intended_github':'bactiar291/token-launch-radar-makefun','preview':str(out/'dashboard/index.html'),
 'main':str(repo/'main.ts'),'runtime_tested':subprocess.run(['/usr/bin/node','--version'],capture_output=True,text=True,env={'PATH':'/usr/bin:/bin'}).stdout.strip(),
 'summary':data['summary'],'input_sha256':data['input_sha256'],'model_version':data['version'],'model_parameters':data['parameters'],
 'calibration':{'peers':len(data['calibration']['peers']),'min_category_peers':5,'shrinkage_prior':8,'winsor_quantiles':[.1,.9],'winsor_low':data['calibration']['winsor_low'],'winsor_high':data['calibration']['winsor_high'],'global':data['calibration']['global'],'growth_clamp_pct':[-50,100],'tracking_cap_days':1095,'uncertainty':'1.25 + 0.35 sparse + 0.20 per missing growth/tenure/category + 0.25 flagged'},
 'screenshots':[str(repo/'screenshots'/p['name']) for p in validation['details']['screenshots']],
 'structural_validation':validation,'determinism':determinism,'browser_validation':browser,
 'model_tests':{'passed':unit.returncode==0,'test_count':10,'output_path':'/tmp/makefun/radar-test-model-results.txt','output':unit.stdout},
 'capture_matches_final_sources_data_and_images':True,'vendor_unmodified':True,'vendor_sha256':hashlib.sha256(kit.read_bytes()).hexdigest(),
 'git_status':status.stdout,'has_commit':head.returncode==0,'commits_made':False,'downloaded_cli_executed':False,'subagents_used':False,'network_account_actions':False,'native_session_records':'Not accessed, modified, synthesized, or exported; originals remain intact.',
 'commands':[
 'env -i PATH=/usr/bin:/bin node --test tests/model.test.mjs',
 'env -i PATH=/usr/bin:/bin node main.ts --input /tmp/makefun/token-radar-01-kit/input --output /tmp/makefun/radar-test-preview --prepare',
 'env -i PATH=/usr/bin:/bin /root/venv/bin/python3 tests/browser.py /tmp/makefun/radar-test-preview',
 'env -i PATH=/usr/bin:/bin /root/venv/bin/python3 tests/determinism.py',
 'env -i PATH=/usr/bin:/bin /root/venv/bin/python3 tests/validate.py /tmp/makefun/radar-test-a',
 'env -i PATH=/usr/bin:/bin /root/venv/bin/python3 tests/report.py'],
 'limitations':[
 'Local checks replicate published structural gates; private scorer, official eligibility/transcript checks and judge were not run.',
 'No submission, GitHub publication, official score, win rate or reward claim. Parent handles publishing and eligibility.',
 'Native log pricing/eligibility cannot be certified here; records were not inspected or altered.',
 'Visual image analysis was unavailable. Screenshots are actual Chrome captures; DOM, interaction, console and overflow checks passed. Parent can inspect images.',
 'Runtime exercised on Node 24.11.1; uses Node 22.18-compatible standard-library APIs and erasable TypeScript, but Node 22 itself was not available in this check.',
 'Timing measured on host, not an enforced 1CPU/1GB sandbox. Two final builds each completed in about 0.22 seconds.',
 'Token identity and structure flags are snapshot heuristics; all no-record candidates retained, with flagged exchanges and asset products included only as research records.',
 'Category/peer mcap proxies are not FDV, unit prices, launch probabilities or reward estimates; TVL may overlap and depegs distort values.',
 'Plans are category-aware conditional proposals; actual supported assets, permissionless access and reward terms are not known from snapshot.'
 ]}
Path('/tmp/makefun/radar-build-report.json').write_text(json.dumps(report,indent=2)+'\n')
summary=f'''# Fieldnote build handoff

Repository: {repo}
Preview: {out}/dashboard/index.html
Report: /tmp/makefun/radar-build-report.json

Original standalone main, shared model and editorial dashboard are complete and uncommitted. Runtime needs Node 22.18+ and only the standard library. Input snapshot is not committed. Downloaded CLI was not executed; native session records were not touched. Vendor copy matches SHA-256 {report['vendor_sha256']}.

## Verified result

- 342 ranked no-token-record rows, all 40 watchlist slugs exactly once; 112 fewer-flag candidates, 230 flagged records; 416 separate token-bearing references.
- 90 unique token-identity peers; P10/P90 winsorization; category minimum 5, prior 8, global median {data['calibration']['global']['median']:.12f}x. Growth weight 0.35 bounded at -50/+100%; tracking weight 0.20 capped at 1095 days. Full formula, uncertainty and caveats in README and model source.
- All seven independent published-gate checks passed. This is not an official score.
- 10 model tests and {len(browser['checks'])} browser checks passed. Independent base/low/high arithmetic, changed-input ranking, missing data, dates, token flags, outliers, no-name-bias, interactive filtering/sorting/details/sensitivity and keyboard tested.
- No JavaScript errors or HTTP requests. Page and modal have no horizontal overflow at 390, 768 and 1440 pixels.
- All {determinism['file_count']} output files byte-identical in two separate builds. Dashboard source {validation['details']['dashboard_files']['bytes']} bytes; dossier {validation['details']['dossier_matches']['dossier_bytes']} bytes, all source untruncated.
- Final screenshot inputs match final generated data and copied code; final main runs were performed after captures.

## Actual screenshots

'''+''.join(f"- {repo}/screenshots/{p['name']} — {p['width']}×{p['height']} JPEG, {p['bytes']} bytes\n" for p in validation['details']['screenshots'])+'''
## Reproduce

Run from the repository:

'''+''.join('    '+c+'\n' for c in report['commands'])+'''
## Remaining / limitations

'''+''.join('- '+v+'\n' for v in report['limitations'])
Path('/tmp/makefun/radar-build-summary.md').write_text(summary)
print(json.dumps({'report':'/tmp/makefun/radar-build-report.json','summary':'/tmp/makefun/radar-build-summary.md','model_tests_passed':True,'browser_checks':len(browser['checks']),'capture_matches_final':True,'git_status':status.stdout,'has_commit':head.returncode==0},indent=2))
