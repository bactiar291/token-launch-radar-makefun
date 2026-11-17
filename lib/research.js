// SPDX-License-Identifier: MIT
// Cross-sectional research only. No chronology or future-launch labels are available.
import { createHash } from 'node:crypto';
import '../dashboard/model.js';
const M=globalThis.FieldModel;
const compare=(a,b)=>a<b?-1:a>b?1:0;
const hash=id=>createHash('sha256').update('fieldnote-group-audit-v1:'+id).digest('hex');
export function splitGroups(protocols) {
 const peers=M.calibrate(protocols).peers;
 const order=[...peers].sort((a,b)=>compare(hash(a.token_group),hash(b.token_group))||compare(a.token_group,b.token_group));
 const auditN=Math.max(1,Math.floor(order.length*.3));
 return {development:order.slice(auditN),audit:order.slice(0,auditN)};
}
const features=(p,asOf)=>{
 const age=M.ageDays(asOf,p.listed_at);
 return [Math.log(p.tvl_usd),p.change_7d===null?0:Math.max(-50,Math.min(100,p.change_7d))/100,age===null?0:Math.min(age,1095)/1095,p.change_7d===null?1:0,age===null?1:0];
};
export function fitLog(peers,asOf) {
 const categories=[...new Set(peers.map(p=>p.category||'Unknown'))].sort(compare);
 const raw=peers.map(p=>features(p,asOf));
 const means=raw[0].map((_,j)=>raw.reduce((s,r)=>s+r[j],0)/raw.length);
 const scales=means.map((m,j)=>Math.sqrt(raw.reduce((s,r)=>s+(r[j]-m)**2,0)/raw.length)||1);
 const rows=raw.map((r,i)=>[1,...r.map((v,j)=>(v-means[j])/scales[j]),...categories.map(c=>(peers[i].category||'Unknown')===c?1:0)]);
 const n=rows[0].length, matrix=Array.from({length:n},()=>Array(n+1).fill(0));
 rows.forEach((r,i)=>{for(let j=0;j<n;j++){for(let k=0;k<n;k++)matrix[j][k]+=r[j]*r[k];matrix[j][n]+=r[j]*Math.log(peers[i].mcap_usd);}});
 for(let j=1;j<n;j++)matrix[j][j]+=10; // fixed ridge penalty, never tuned on audit labels
 for(let j=0;j<n;j++){
  let pivot=j;for(let k=j+1;k<n;k++)if(Math.abs(matrix[k][j])>Math.abs(matrix[pivot][j]))pivot=k;
  [matrix[j],matrix[pivot]]=[matrix[pivot],matrix[j]];
  const d=matrix[j][j];for(let k=j;k<=n;k++)matrix[j][k]/=d;
  for(let i=0;i<n;i++)if(i!==j){const f=matrix[i][j];for(let k=j;k<=n;k++)matrix[i][k]-=f*matrix[j][k];}
 }
 return {categories,means,scales,coefficients:matrix.map(r=>r[n]),lambda:10};
}
export function predictLog(p,asOf,fit) {
 const x=[1,...features(p,asOf).map((v,j)=>(v-fit.means[j])/fit.scales[j]),...fit.categories.map(c=>(p.category||'Unknown')===c?1:0)];
 return x.reduce((s,v,i)=>s+v*fit.coefficients[i],0);
}
export function metrics(records,key) {
 const residuals=records.map(r=>Math.log(r.actual_usd)-Math.log(r.predictions[key]));
 const abs=residuals.map(Math.abs), n=abs.length;
 return {n,mean_abs_log:abs.reduce((s,x)=>s+x,0)/n,median_factor:Math.exp(M.quantile(abs,.5)),rms_log:Math.sqrt(residuals.reduce((s,x)=>s+x*x,0)/n),within_2x:abs.filter(x=>x<=Math.log(2)).length/n,within_5x:abs.filter(x=>x<=Math.log(5)).length/n};
}
const modelNames=['legacy','ratio','log_ridge'];
function predictions(target,train,asOf) {
 const cal=M.calibrate(train),fit=fitLog(cal.peers,asOf);
 return {legacy:M.score(target,asOf,cal).implied_value_usd,ratio:M.score(target,asOf,cal,{growthWeight:0,tenureWeight:0}).implied_value_usd,log_ridge:Math.exp(predictLog(target,asOf,fit))};
}
export function evaluate(snapshot) {
 const all=M.calibrate(snapshot.protocols).peers;
 if(all.length<12)return {available:false,reason:'Fewer than 12 eligible token groups; no defensible audit split',n:all.length,selected:'legacy'};
 const split=splitGroups(snapshot.protocols), developmentIds=new Set(split.development.map(p=>p.token_group));
 const groups=M.tokenGroups(snapshot.protocols),trainRecords=ids=>groups.filter(g=>ids.has(g.id)).flatMap(g=>g.members);
 const record=(p,train)=>({slug:p.slug,group:p.token_group,actual_usd:p.mcap_usd,train_groups:[...new Set(M.calibrate(train).peers.map(p=>p.token_group))].sort(compare),predictions:predictions(p,train,snapshot.as_of)});
 const cv=split.development.map(p=>record(p,trainRecords(new Set([...developmentIds].filter(id=>id!==p.token_group)))));
 const development=Object.fromEntries(modelNames.map(k=>[k,metrics(cv,k)]));
 // Complexity must earn >=10% lower mean absolute log error without worse median error.
 let selected='legacy';
 if(development.ratio.mean_abs_log<=development.legacy.mean_abs_log&&development.ratio.median_factor<=development.legacy.median_factor)selected='ratio';
 if(development.log_ridge.mean_abs_log<=development[selected].mean_abs_log*.9&&development.log_ridge.median_factor<=development[selected].median_factor)selected='log_ridge';
 const audit=split.audit.map(p=>record(p,trainRecords(developmentIds)));
 const heldout=Object.fromEntries(modelNames.map(k=>[k,metrics(audit,k)]));
 const residuals=cv.map(r=>Math.abs(Math.log(r.actual_usd/r.predictions[selected]))).sort((a,b)=>a-b);
 const order=Math.min(residuals.length,Math.ceil((residuals.length+1)*.9));
 const q=residuals[order-1],factor=Math.exp(q);
 const covered=audit.filter(r=>Math.abs(Math.log(r.actual_usd/r.predictions[selected]))<=q).length;
 return {available:true,selected,n:all.length,development_n:cv.length,audit_n:audit.length,development,heldout,
  residual:{nominal:.9,source:'Development leave-one-token-group-out absolute log residuals',order,log_radius:q,factor,audit_covered:covered,audit_n:audit.length,audit_coverage:covered/audit.length},
  split_rule:'SHA-256(fieldnote-group-audit-v1:group ID), lowest floor(30% × N) audit; remaining development. No time split.',
  selection_rule:'Ratio replaces legacy only if mean absolute log and median factor do not worsen. Ridge requires at least 10% lower mean absolute log error and no worse median factor on development LOO. Audit never selects or tunes.',
  limitation:'Predicting observed token market caps within one snapshot is NOT validation of future launches or airdrop returns. Survivorship, identity ambiguity, overlapping TVL and domain shift remain. Residual range is empirical, not guaranteed coverage.',
  cv,audit,fit:fitLog(all,snapshot.as_of)};
}
