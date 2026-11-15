// SPDX-License-Identifier: MIT
// Explicit unit fixtures only; never used for screenshots or production evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../dashboard/model.js';
const M=globalThis.FieldModel;
const p={slug:'unit-fixture',name:'Unit fixture',category:'Lending',chains:['Ethereum'],tvl_usd:100000000,change_7d:5,mcap_usd:null,listed_at:'2024-01-01',gecko_id:null,symbol:null};
const categories=['Lending','Dexs','Yield','Yield Aggregator','Farm','Liquidity Manager','CDP','Restaking','RWA',null,'Unknown'];
const chains=[[],['Ethereum'],['Solana'],['Base'],['unpriced'],['Solana','Ethereum']];
const sum=(steps,key)=>steps.some(s=>s[key]===null)?null:[0,1].map(i=>Math.round(steps.reduce((n,s)=>n+s[key][i],0)*100)/100);
const range=r=>r===null||(Array.isArray(r)&&r.length===2&&r.every(Number.isFinite)&&r[0]>=0&&r[0]<=r[1]);
test('structured steps are the exact export source, with valid text and numeric ranges',()=>{
 for(const category of categories)for(const chain of chains){
  const plan=M.farmPlan({...p,category,chains:chain});
  assert.deepEqual(plan.farm_steps,plan.steps.map(M.stepText));
  assert.ok(plan.steps.length>=3&&plan.steps.length<=12);
  for(const [i,s] of plan.steps.entries()){
   assert.ok(plan.farm_steps[i].trim().length>=20&&plan.farm_steps[i].trim().length<=600,plan.farm_steps[i]);
   for(const k of ['capital_at_risk_usd_range','estimated_fee_usd_range','time_minutes_range'])assert.ok(range(s[k]),k);
   for(const k of ['action','title','prerequisite','completion_evidence','assumption_label'])assert.ok(s[k].length>0,k);
   assert.match(s.assumption_label,/assumption/);
  }
  assert.ok(!/NaN|undefined|Infinity/.test(JSON.stringify(plan)));
 }
});
test('one pilot capital envelope, fee allocation once, reviews included in total time',()=>{
 for(const chain of ['Ethereum','Solana','Base']){
  const plan=M.farmPlan({...p,chains:[chain]});
  assert.equal(plan.mode,'Conditional pilot');
  assert.deepEqual(plan.totals.capital_at_risk_usd_range,[100,300]);
  assert.deepEqual(plan.totals.estimated_fee_usd_range,sum(plan.steps,'estimated_fee_usd_range'));
  assert.deepEqual(plan.totals.estimated_fee_usd_range,chain==='Ethereum'?[15,60]:chain==='Solana'?[.2,3]:[1,10]);
  assert.deepEqual(plan.totals.active_time_minutes_range,[140,215]);
  assert.deepEqual(plan.totals.active_time_minutes_range,sum(plan.steps,'time_minutes_range'));
  assert.deepEqual(plan.totals.review_minutes_range,[40,60]);
  assert.equal(plan.totals.review_count,4);
  assert.equal(plan.totals.lockup_days_range,null);
  assert.equal(plan.steps.filter(s=>s.estimated_fee_usd_range[1]>0).length,3);
  assert.ok(sum(plan.steps,'capital_at_risk_usd_range')[1]>plan.totals.capital_at_risk_usd_range[1]);
  assert.deepEqual(plan.steps[0].capital_at_risk_usd_range,[0,0]);
  assert.deepEqual(plan.steps[0].estimated_fee_usd_range,[0,0]);
 }
});
test('unknown prices stay null; unknown chains and ambiguous structures never invent access',()=>{
 const unknown=M.farmPlan({...p,chains:['Unpriced network']});
 assert.equal(unknown.totals.estimated_fee_usd_range,null);
 assert.match(unknown.fees,/Unknown/);
 for(const modified of [{chains:[]},{category:null},{category:'RWA'},{name:'Unit fixture V2'},{name:'Wrapped fixture'},{mcap_usd:1000}]){
  const plan=M.farmPlan({...p,...modified});
  assert.equal(plan.mode,'Monitor / access check');
  assert.deepEqual(plan.totals.capital_at_risk_usd_range,[0,0]);
  assert.deepEqual(plan.totals.estimated_fee_usd_range,[0,0]);
  assert.deepEqual(plan.totals.active_time_minutes_range,[130,195]);
  assert.ok(plan.steps.every(s=>s.capital_at_risk_usd_range[1]===0&&s.estimated_fee_usd_range[1]===0));
 }
});
test('planning depends on category and chain, never names; chain order is stable',()=>{
 assert.deepEqual(M.farmPlan(p),M.farmPlan({...p,name:'Another unit label',slug:'other-fixture'}));
 assert.deepEqual(M.farmPlan({...p,chains:['Solana','Ethereum']}),M.farmPlan({...p,chains:['Ethereum','Solana']}));
 assert.notDeepEqual(M.farmPlan(p).steps,M.farmPlan({...p,category:'Dexs'}).steps);
 assert.notDeepEqual(M.farmPlan(p).totals,M.farmPlan({...p,chains:['Solana']}).totals);
});
test('sparse peers, missing optional facts, outlier bounds, no-token watchlist and order invariance',()=>{
 const peer={...p,slug:'unit-peer',name:'Unit peer',symbol:'UNIT',gecko_id:'unit-id',mcap_usd:20000000};
 const missing={...p,category:null,chains:[],change_7d:null,listed_at:null};
 const snapshot={as_of:'2026-11-14',source:'Explicit unit fixture, not a real snapshot',floor_usd:50000000,protocols:[missing,peer],watchlist:[p.slug]};
 const result=M.build(snapshot);
 assert.equal(result.rows.length,1);assert.equal(result.live.length,1);assert.ok(result.rows[0].watchlist);
 assert.equal(result.rows[0].model.category_weight,0);
 assert.equal(result.rows[0].model.growth_multiplier,1);assert.equal(result.rows[0].model.tenure_multiplier,1);
 assert.equal(result.rows[0].plan.mode,'Monitor / access check');
 assert.deepEqual(result.rows,M.build({...snapshot,protocols:[peer,missing]}).rows);
 for(const growth of [-1e12,1e12]){
  const score=M.score({...p,change_7d:growth,tvl_usd:Number.MAX_SAFE_INTEGER},snapshot.as_of,result.calibration);
  assert.ok(Number.isFinite(score.implied_value_usd)&&score.implied_value_usd<=1e14);
 }
 assert.ok(!/NaN|Infinity|undefined/.test(JSON.stringify(result)));
 assert.throws(()=>M.build({...snapshot,protocols:[missing]}),/No observed token-bearing peers/);
 assert.throws(()=>M.build({...snapshot,protocols:[{...missing,change_7d:undefined},peer]}),/Invalid numeric field/);
});
