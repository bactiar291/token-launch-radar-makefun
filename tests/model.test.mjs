// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import '../dashboard/model.js';
const M=globalThis.FieldModel;
const input=process.argv.find(a=>a.endsWith('snapshot.json'))||'/tmp/makefun/token-radar-01-kit/input/snapshot.json';
const snapshot=JSON.parse(fs.readFileSync(input,'utf8'));
const d=M.build(snapshot),cal=d.calibration,p=d.rows.find(r=>r.token_status==='no-record'&&r.change_7d!==null&&r.age_days!==null);
const cleanEnv={PATH:'/usr/bin:/bin'};
test('complete no-record coverage, live classification uses either identifier, no cap heuristic',()=>{
 assert.equal(d.rows.length,snapshot.protocols.filter(p=>!p.gecko_id&&!p.symbol).length);
 assert.equal(d.rows.filter(p=>p.watchlist).length,snapshot.watchlist.length);
 assert.ok(d.rows.filter(p=>p.token_status==='no-record').length>=100);
 for(const r of d.live) assert.ok(r.symbol||r.gecko_id);
 assert.equal(M.hasToken({...p,symbol:'TEST',mcap_usd:null,gecko_id:null}),true);
 assert.equal(M.hasToken({...p,symbol:null,mcap_usd:null,gecko_id:'test-id'}),true);
 assert.equal(M.hasToken({...p,symbol:null,gecko_id:null,mcap_usd:123}),false);
 assert.ok(M.flags({...p,symbol:null,gecko_id:null,mcap_usd:123}).some(x=>x.includes('Market cap')));
});
test('UTC tracking dates reject invalid, future, missing and impossible dates',()=>{
 assert.equal(M.ageDays('2024-03-01','2024-02-28'),2);
 assert.equal(M.ageDays('2026-11-14','2026-11-14'),0);
 for(const v of [null,'invalid','2026-11-15','2026-02-30']) assert.equal(M.ageDays('2026-11-14',v),null);
});
test('unknown growth and tenure stay unknown, neutral factors and wider ranges',()=>{
 const a=M.score({...p,change_7d:0,listed_at:snapshot.as_of},snapshot.as_of,cal);
 const b=M.score({...p,change_7d:null,listed_at:null},snapshot.as_of,cal);
 assert.equal(b.age_days,null);assert.equal(b.model.bounded_growth_pct,null);
 assert.equal(b.model.growth_multiplier,1);assert.equal(b.model.tenure_multiplier,1);
 assert.equal(b.model.missing_count,2);assert.ok(b.model.uncertainty>a.model.uncertainty);
});
test('growth tails bounded and maturity stops at 1095 days',()=>{
 assert.equal(M.score({...p,change_7d:1e12},snapshot.as_of,cal).model.growth_multiplier,1.35);
 assert.equal(M.score({...p,change_7d:-1e12},snapshot.as_of,cal).model.growth_multiplier,.825);
 assert.equal(M.score({...p,listed_at:'2000-01-01'},snapshot.as_of,cal).model.tenure_multiplier,1.1);
});
test('formula independently reproduces all exported integer values and envelopes',()=>{
 const q=(a,t)=>{a=[...a].sort((x,y)=>x-y);const i=(a.length-1)*t,l=Math.floor(i);return a[l]+(a[Math.ceil(i)]-a[l])*(i-l);};
 const ratios=cal.peers.map(r=>r.mcap_usd/r.tvl_usd),lo=q(ratios,.1),hi=q(ratios,.9);
 assert.equal(lo,cal.winsor_low);assert.equal(hi,cal.winsor_high);
 const global=cal.peers.map(r=>Math.min(hi,Math.max(lo,r.mcap_usd/r.tvl_usd)));
 for(const r of d.rows){
  const cohort=cal.peers.filter(v=>v.category===r.category).map(v=>Math.min(hi,Math.max(lo,v.mcap_usd/v.tvl_usd)));
  const w=cohort.length>=5?cohort.length/(cohort.length+8):0;
  const ratio=t=>Math.exp(w*Math.log(cohort.length?q(cohort,t):q(global,t))+(1-w)*Math.log(q(global,t)));
  const growth=r.change_7d===null?1:1+.35*Math.min(100,Math.max(-50,r.change_7d))/100;
  const days=r.listed_at===null?null:Math.floor((Date.parse(snapshot.as_of+'T00:00:00Z')-Date.parse(r.listed_at+'T00:00:00Z'))/86400000);
  const tenure=days===null||days<0?1:1+.2*(Math.min(days,1095)/1095-.5);
  const value=Math.max(1,Math.min(1e14,Math.round(r.tvl_usd*ratio(.5)*growth*tenure)));
  assert.equal(r.implied_value_usd,value,r.slug);
  assert.equal(r.model.ratio,ratio(.5));assert.equal(r.model.growth_multiplier,growth);assert.equal(r.model.tenure_multiplier,tenure);
  assert.ok(r.low_usd<=value&&r.high_usd>=value);
  const missing=(r.change_7d===null?1:0)+(days===null||days<0?1:0)+(!r.category?1:0);
  const u=1.25+(cohort.length<5?.35:0)+missing*.20+(r.flags.length?.25:0);
  const round=x=>Math.max(1,Math.min(1e14,Math.round(x)));
  assert.equal(r.low_usd,round(r.tvl_usd*Math.min(ratio(.5),ratio(.25))*growth*tenure/u),r.slug+' low');
  assert.equal(r.high_usd,round(r.tvl_usd*Math.max(ratio(.5),ratio(.75))*growth*tenure*u),r.slug+' high');
  const f=r.model;assert.equal(Math.round(r.tvl_usd*f.ratio*f.growth_multiplier*f.tenure_multiplier*f.scale),value);
 }
});
test('minimum cohort, shrinkage and peer outlier winsorization',()=>{
 for(const r of d.rows){const n=r.model.cohort_n;assert.equal(r.model.category_weight,n<5?0:n/(n+8));}
 const extreme=structuredClone(snapshot.protocols);const eligible=extreme.find(p=>p.slug===cal.peers[0].slug);eligible.mcap_usd=1e14;
 const altered=M.calibrate(extreme);assert.ok(altered.peers.some(p=>p.ratio>p.winsor_ratio));
 assert.ok(altered.global.median>0&&altered.global.median<cal.global.median*2);
 assert.equal(new Set(cal.peers.map(p=>p.gecko_id?'id:'+p.gecko_id.toLowerCase():'symbol:'+p.symbol.toUpperCase())).size,cal.peers.length);
});
test('no name ranking bias and input permutation determinism',()=>{
 const renamed={...p,name:'Independent Research Placeholder',slug:'unit-test-placeholder'};
 assert.equal(M.score(renamed,snapshot.as_of,cal).implied_value_usd,M.score(p,snapshot.as_of,cal).implied_value_usd);
 const reverse={...snapshot,protocols:[...snapshot.protocols].reverse()};
 assert.deepEqual(M.build(reverse).rows,d.rows);
});
test('category-aware access plans, concrete bounds and step lengths',()=>{
 for(const r of d.rows){assert.ok(r.farm_steps.length>=3&&r.farm_steps.length<=12);for(const s of r.farm_steps)assert.ok(s.trim().length>=20&&s.trim().length<=600,r.slug);}
 for(const cat of ['RWA','CEX','Risk Curators','Chain','Onchain Capital Allocator','Uncollateralized Lending']){
  const plan=M.farmPlan({...p,category:cat});assert.equal(plan.mode,'Monitor / access check');assert.match(plan.capital,/\$0/);assert.match(plan.farm_steps.join(' '),/closed|unclear/);
 }
 assert.match(M.farmPlan({...p,category:'Dexs'}).farm_steps.join(' '),/impermanent loss/i);
 assert.match(M.farmPlan({...p,category:'Lending'}).farm_steps.join(' '),/do not borrow/i);
});
test('changed input runs entrypoint and changes ranking; output precedence and directory input',()=>{
 const changed=structuredClone(snapshot);const target=changed.protocols.find(x=>x.slug===d.rows.at(-1).slug);target.tvl_usd=500000000000;
 const dir='/tmp/makefun/radar-test-mutated';fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(dir+'/snapshot.json',JSON.stringify(changed));
 const r=spawnSync(process.execPath,['main.ts','--prepare','--input',dir,'--output',dir+'/output'],{cwd:new URL('..',import.meta.url),env:{...cleanEnv,MAKEFUN_OUTPUT_DIR:'/tmp/makefun/radar-test-unused'},encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);const rows=JSON.parse(fs.readFileSync(dir+'/output/board.json')).rows;
 assert.equal(rows[0].slug,target.slug);assert.notEqual(rows[0].slug,d.rows[0].slug);
 assert.notEqual(rows.find(p=>p.slug===target.slug).implied_value_usd,d.rows.at(-1).implied_value_usd);
});
test('scenario recalculates values and ranks without changing baseline data',()=>{
 const copy=JSON.stringify(d.rows);const scenario=M.build(snapshot,{growthWeight:.7,peerWeight:0,tenureWeight:0});
 assert.ok(scenario.rows.some(r=>r.rank!==d.rows.find(p=>p.slug===r.slug).rank));assert.equal(JSON.stringify(d.rows),copy);
});
