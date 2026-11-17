// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import '../dashboard/model.js';
import fs from 'node:fs';
import {evaluate,splitGroups,fitLog,predictLog,metrics} from '../lib/research.js';
const M=globalThis.FieldModel;
// Artificial fixtures exercise identity linkage; never production evidence.
const p={slug:'a',name:'Fixture',category:'Lending',tvl_usd:100,change_7d:0,listed_at:null,mcap_usd:20,symbol:'SAME',gecko_id:'same-id',chains:[]};
test('ticker fallback aliases and transitive IDs form one whole held-out group',()=>{
 const rows=[p,{...p,slug:'b',gecko_id:null,tvl_usd:90},{...p,slug:'c',gecko_id:'another-id',symbol:'same',tvl_usd:80}];
 const groups=M.tokenGroups(rows);
 assert.equal(groups.length,1);assert.deepEqual(groups[0].members.map(x=>x.slug),['a','b','c']);
 assert.equal(M.calibrate(rows).peers.length,1);
 assert.deepEqual(M.tokenGroups([...rows].reverse()),groups);
});
test('zero/missing caps and nonpositive TVL cannot enter ratio training',()=>{
 const rows=[p,...[0,null,-1].map((mcap_usd,i)=>({...p,slug:'cap'+i,symbol:'CAP'+i,gecko_id:null,mcap_usd})),{...p,slug:'zero-tvl',symbol:'ZERO',gecko_id:null,tvl_usd:0}];
 assert.equal(M.calibrate(rows).peers.length,1);
});
const snapshot=JSON.parse(fs.readFileSync('/tmp/makefun/campaign-20261117/kits/token-radar-01/verified/token-radar-01-kit/input/snapshot.json','utf8'));
test('whole-group CV, untouched audit and permutation determinism',()=>{
 const e=evaluate(snapshot), split=splitGroups(snapshot.protocols);
 assert.ok(e.available);assert.equal(e.n,e.development_n+e.audit_n);
 const audit=new Set(split.audit.map(p=>p.token_group));
 for(const row of [...e.cv,...e.audit]){
  assert.ok(!row.train_groups.includes(row.group));
  assert.ok(row.train_groups.every(g=>!audit.has(g)));
  assert.ok(Object.values(row.predictions).every(v=>Number.isFinite(v)&&v>0));
 }
 assert.deepEqual(evaluate({...snapshot,protocols:[...snapshot.protocols].reverse()}),e);
 const changed=structuredClone(snapshot), groups=M.tokenGroups(changed.protocols);
 for(const g of groups)if(audit.has(g.id))for(const r of g.members)if(r.mcap_usd>0)r.mcap_usd*=100;
 const other=evaluate(changed);
 assert.deepEqual(other.development,e.development);assert.equal(other.selected,e.selected);
 assert.equal(other.residual.factor,e.residual.factor);
 assert.deepEqual(other.audit.map(r=>r.predictions),e.audit.map(r=>r.predictions));
});
test('independent metric and residual arithmetic; no in-sample coverage claim',()=>{
 const e=evaluate(snapshot), rows=e.audit;
 const errors=rows.map(r=>Math.abs(Math.log(r.actual_usd/r.predictions[e.selected]))).sort((a,b)=>a-b);
 const m=e.heldout[e.selected];
 assert.ok(Math.abs(m.mean_abs_log-errors.reduce((a,b)=>a+b,0)/errors.length)<1e-12);
 const dev=e.cv.map(r=>Math.abs(Math.log(r.actual_usd/r.predictions[e.selected]))).sort((a,b)=>a-b);
 assert.equal(e.residual.log_radius,dev[Math.min(dev.length,Math.ceil((dev.length+1)*.9))-1]);
 assert.equal(e.residual.audit_covered,errors.filter(x=>x<=e.residual.log_radius).length);
 assert.equal(metrics([{actual_usd:100,predictions:{x:10}},{actual_usd:10,predictions:{x:100}}],'x').median_factor,Math.exp(Math.log(10)));
});
test('ridge finite with missing features, constant TVL and extreme caps',()=>{
 const train=Array.from({length:15},(_,i)=>({...p,slug:'fixture-'+i,symbol:'F'+i,gecko_id:null,mcap_usd:i===0?1e14:20+i,listed_at:null,change_7d:null}));
 const fit=fitLog(train,'2026-11-14');
 assert.ok(Number.isFinite(predictLog(p,'2026-11-14',fit)));
 assert.deepEqual(fitLog(train,'2026-11-14'),fit);
});
test('selected model reproduces independent log predictions and every residual endpoint',()=>{
 const e=evaluate(snapshot),d=M.build(snapshot,M.DEFAULTS,e),round=x=>Math.max(1,Math.min(1e14,Math.round(x)));
 for(const r of d.rows){
  const prediction=Math.exp(predictLog(r,snapshot.as_of,e.fit));
  assert.equal(r.implied_value_usd,round(prediction),r.slug);
  assert.equal(r.low_usd,round(prediction/e.residual.factor),r.slug+' low');
  assert.equal(r.high_usd,round(prediction*e.residual.factor),r.slug+' high');
  assert.ok(r.low_usd<=r.implied_value_usd&&r.high_usd>=r.implied_value_usd);
  assert.deepEqual(M.score(r,snapshot.as_of,d.calibration),M.score(r,snapshot.as_of,d.calibration,M.DEFAULTS));
 }
 const scenario=M.build(snapshot,{growthWeight:.7,tenureWeight:0,peerWeight:0},e);
 assert.ok(scenario.rows.some(r=>d.rows.find(x=>x.slug===r.slug).rank!==r.rank));
 for(const [i,r] of scenario.rows.entries()){
  assert.equal(r.rank,i+1);if(i)assert.ok(scenario.rows[i-1].implied_value_usd>=r.implied_value_usd);
  assert.equal(r.implied_value_usd,round(r.tvl_usd*r.model.ratio*r.model.growth_multiplier*r.model.tenure_multiplier*r.model.scale));
 }
 const unknown=M.score({...d.rows[0],change_7d:null,listed_at:null,category:null},snapshot.as_of,d.calibration);
 assert.equal(unknown.model.growth_multiplier,1);assert.equal(unknown.model.tenure_multiplier,1);assert.equal(unknown.age_days,null);
 assert.ok(Number.isFinite(unknown.implied_value_usd));
});
