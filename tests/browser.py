import asyncio, json, sys, functools, threading, hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.async_api import async_playwright

out=Path(sys.argv[1]).resolve(); repo=Path.cwd(); shots=repo/'screenshots'; shots.mkdir(exist_ok=True)
artifacts=repo.parent/'artifacts'
assert json.loads((artifacts/'preview-determinism.json').read_text())['identical_bytes']
handler=functools.partial(SimpleHTTPRequestHandler,directory=str(out))
server=ThreadingHTTPServer(('127.0.0.1',0),handler)
origin=f'http://127.0.0.1:{server.server_port}'
threading.Thread(target=server.serve_forever,daemon=True).start()
async def main():
  checks={}; errors=[]; requests=[]; layouts={}
  async with async_playwright() as pw:
    browser=await pw.chromium.launch(headless=True, executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    page=await browser.new_page(viewport={'width':1440,'height':900}, device_scale_factor=1, reduced_motion='reduce')
    await page.context.tracing.start(screenshots=True,snapshots=True,sources=True)
    async def local_only(route):
      if route.request.url.startswith(origin+'/'): await route.continue_()
      else: await route.abort()
    await page.route('**/*',local_only)
    page.on('console', lambda msg: errors.append('console:'+msg.text) if msg.type=='error' else None)
    page.on('pageerror', lambda e: errors.append('pageerror:'+str(e)))
    page.on('request', lambda req: requests.append(req.url))
    response=await page.goto(origin+'/dashboard/index.html', wait_until='load')
    checks['local_server_ready']=response is not None and response.status==200
    await page.wait_for_selector('#rows tr')
    checks['default_candidate_view']=(await page.locator('#status').input_value())=='no-record'
    checks['baseline_browser_equals_export']=await page.evaluate('FIELD_DATA.rows.every(p => FieldModel.score(p,FIELD_DATA.as_of,FIELD_DATA.calibration).implied_value_usd === p.implied_value_usd)')
    await page.screenshot(path=str(shots/'1-board.jpg'),type='jpeg',quality=90)
    await page.locator('#open-evidence').click()
    checks['model_evidence']='Untouched audit · 26 groups' in await page.locator('.audit-body').inner_text()
    checks['model_limitations']='NOT validation of future launches or airdrop returns' in await page.locator('.audit-body').inner_text()
    await page.screenshot(path=str(shots/'4-evidence.jpg'),type='jpeg',quality=90)
    await page.keyboard.press('Escape')
    if (shots/'4-plan.jpg').exists(): (shots/'4-plan.jpg').unlink()
    # The real watchlist record Curvance has a conditional lending plan and a usable category cohort.
    await page.locator('#search').fill('curvance')
    checks['search']=(await page.locator('#rows tr').count())==1
    await page.locator('#rows button[data-slug]').first.focus()
    await page.keyboard.press('Enter')
    checks['keyboard_detail_open']=await page.locator('dialog').is_visible()
    checks['detail_source_fields']=await page.locator('.raw-data pre').count()==1
    checks['detail_farm_steps']=await page.locator('.steps li').count()==6
    checks['detail_peer_table']=await page.locator('.peer-table tbody tr').count()>=5
    checks['structured_steps_match_ui']=await page.evaluate('(()=>{const p=FIELD_DATA.rows.find(p=>p.slug==="curvance");return [...document.querySelectorAll(".steps li")].every((li,i)=>{const s=p.plan.steps[i];return li.querySelector("h4").textContent===s.title&&li.querySelector("p").textContent===s.action&&li.textContent.includes(s.prerequisite)&&li.textContent.includes(s.completion_evidence)&&li.textContent.includes(FieldModel.rangeText(s.estimated_fee_usd_range))&&li.textContent.includes(FieldModel.rangeText(s.time_minutes_range,"min"))})})()')
    checks['budget_summary_visible']=await page.locator('.plan-budget').is_visible() and 'Total active time' in await page.locator('.plan-budget').inner_text()
    checks['valuation_and_budget_in_view']=await page.evaluate('Boolean([".big-value",".plan-budget",".budget-inputs"].every(sel=>{const r=document.querySelector(sel).getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}))')
    checks['unknown_fee_initial']='Quote required' in await page.locator('#budget-result').inner_text()
    await page.locator('#quoted-fees').fill('12')
    await page.locator('#hourly-cost').fill('30')
    checks['fee_cap_and_resource_arithmetic']='Over fee cap' in await page.locator('#budget-result').inner_text() and '$82–119.5' in await page.locator('#budget-result').inner_text()
    await page.locator('#quoted-fees').fill('5')
    checks['fee_within_cap']='Within fee cap' in await page.locator('#budget-result').inner_text()
    await page.screenshot(path=str(shots/'2-detail.jpg'),type='jpeg',quality=90)
    await page.locator('.steps li').nth(3).scroll_into_view_if_needed()

    checks['exit_evidence_present']='Exit & reconcile' in await page.locator('.steps').inner_text()
    # Tab stays in native modal and Escape restores originating row focus.
    await page.keyboard.press('Tab')
    checks['modal_focus_contained']=await page.evaluate('document.activeElement.closest("dialog") !== null')
    await page.keyboard.press('Escape')
    checks['escape_closed']=not await page.locator('dialog').is_visible()
    checks['focus_restored']=await page.evaluate('document.activeElement.matches(".protocol-button")')
    await page.locator('#reset').click()
    await page.locator('#category').select_option('Lending')
    await page.locator('#chain').select_option('Ethereum')
    checks['category_chain_filter']=await page.evaluate('Array.from(document.querySelectorAll("#rows tr")).every(tr=>{const p=FIELD_DATA.rows.find(p=>p.slug===tr.dataset.slug);return p.category==="Lending"&&p.chains.includes("Ethereum")})')
    await page.locator('[data-sort="change_7d"]').focus()
    await page.keyboard.press('Enter')
    checks['sort_descending']=await page.evaluate('(()=>{const a=[...document.querySelectorAll("#rows tr")].map(tr=>FIELD_DATA.rows.find(p=>p.slug===tr.dataset.slug).change_7d).filter(x=>x!==null);return a.every((n,i)=>i===0||a[i-1]>=n)})()')
    checks['global_and_view_rank']=await page.evaluate('document.querySelector("[data-sort=rank]").textContent.includes("Global") && [...document.querySelectorAll(".view-position")].every((el,i)=>el.textContent==="view "+(i+1))')
    await page.screenshot(path=str(shots/'3-filtered.jpg'),type='jpeg',quality=90)
    await page.locator('[data-sort="change_7d"]').click()
    checks['sort_ascending']=await page.evaluate('(()=>{const a=[...document.querySelectorAll("#rows tr")].map(tr=>FIELD_DATA.rows.find(p=>p.slug===tr.dataset.slug).change_7d).filter(x=>x!==null);return a.every((n,i)=>i===0||a[i-1]<=n)})()')
    await page.locator('#search').fill('zzzz-no-match')
    checks['empty_state']=await page.locator('#empty').is_visible()
    await page.locator('#empty-reset').click()
    checks['reset']=(await page.locator('#search').input_value())=='' and (await page.locator('#category').input_value())=='all'
    await page.locator('#watchlist').check()
    checks['all_watchlist_visible']='40 candidate records' in (await page.locator('#results').inner_text())
    await page.locator('#next').click()
    checks['pagination']='13–24' in (await page.locator('#page-info').inner_text())
    await page.locator('#reset').click()
    await page.locator('#status').select_option('recorded')
    checks['token_reference_filter']='416 token-bearing references' in (await page.locator('#results').inner_text())
    await page.locator('#search').fill('aave horizon')
    checks['null_mcap_token_stays_recorded']=await page.locator('#rows tr').count()==1 and 'Unknown' in await page.locator('#rows').inner_text()
    await page.locator('#reset').click()
    baseline=await page.locator('#rows').inner_text()
    await page.locator('#peer-weight').fill('0')
    await page.locator('#growth-weight').fill('70')
    checks['sensitivity_changes_values_ranks']=baseline != await page.locator('#rows').inner_text() and 'ranks changed' in await page.locator('#scenario-note').inner_text()
    checks['scenario_label']='NOT EXPORTED' in await page.locator('#mode-label').inner_text()
    await page.locator('#restore').click()
    checks['baseline_restored']=baseline==await page.locator('#rows').inner_text()
    # A restricted real record must render an explicit zero-spend monitoring plan.
    monitor_slug=await page.evaluate('FIELD_DATA.rows.find(p=>p.plan.mode==="Monitor / access check").slug')
    await page.locator('#search').fill(monitor_slug)
    await page.locator(f'button[data-slug="{monitor_slug}"]').click()
    checks['monitor_zero_budget']=await page.evaluate('(()=>{const b=document.querySelector(".plan-budget").innerText;return document.querySelector(".detail-banner").innerText.includes("Monitor / access check")&&b.includes("$0")&&[...document.querySelectorAll(".step-budget")].every(x=>x.innerText.includes("Capital $0")&&x.innerText.includes("Fees $0"))})()')
    await page.keyboard.press('Escape')
    await page.locator('#reset').click()
    await page.locator('#reset').focus()
    await page.keyboard.press('/')
    checks['slash_focus']=(await page.evaluate('document.activeElement.id'))=='search'
    for width in [390,768,1440]:
      await page.set_viewport_size({'width':width,'height':900})
      await page.locator('#reset').click()
      overflow=await page.evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth')
      await page.locator('#rows button[data-slug]').first.click()
      dialog_overflow=await page.evaluate('document.querySelector("dialog").scrollWidth > document.querySelector("dialog").clientWidth')
      layouts[str(width)]={'page_horizontal_overflow':overflow,'dialog_horizontal_overflow':dialog_overflow}
      await page.keyboard.press('Escape')
    checks['responsive_no_overflow']=not any(v for x in layouts.values() for v in x.values())
    checks['no_js_errors']=not errors
    checks['offline_only']=all(x.startswith(origin+'/') for x in requests)
    await page.context.tracing.stop(path=str(artifacts/'browser-trace.zip'))
    result={'checks':checks,'layouts':layouts,'console_errors':errors,'requests':requests,'page_url':origin+'/dashboard/index.html','input_sha256':await page.evaluate('FIELD_DATA.input_sha256'),'screenshots':[{'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(shots.glob('*.jpg'))], 'visual_review':False}
    (artifacts/'browser-test.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2)); await browser.close()
    if not all(checks.values()): raise SystemExit(1)
try:
  asyncio.run(main())
finally:
  server.shutdown();server.server_close()
