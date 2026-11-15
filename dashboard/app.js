/* SPDX-License-Identifier: MIT */
(function(){
'use strict';
const D=window.FIELD_DATA,M=window.FieldModel,$=id=>document.getElementById(id);
if(!D||!M){$('results').textContent='Dataset unavailable. Run main.ts and open output/dashboard/index.html.';return;}
const esc=s=>String(s??'Unknown').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const exact=n=>n===null||n===undefined?'Unknown':new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n);
function money(n){if(n===null||n===undefined)return 'Unknown';return '$'+(n>=1e9?(n/1e9).toFixed(2)+'B':n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?(n/1e3).toFixed(0)+'K':n.toFixed(0));}
const pct=n=>n===null?'Unknown':(n>0?'+':'')+n.toFixed(1)+'%';
const age=n=>n===null?'Unknown':n>=365?(n/365).toFixed(1)+'y':n+'d';
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const state={q:'',status:'no-record',category:'all',chain:'all',watch:false,key:'rank',direction:1,page:0,selected:null,parameters:{...M.DEFAULTS}};
let current=D.rows,returnFocus=null;
const pageSize=12;
function active(){return Object.keys(M.DEFAULTS).some(k=>state.parameters[k]!==M.DEFAULTS[k]);}
$('edition').textContent=D.as_of+' / SEALED SNAPSHOT';
$('coverage').innerHTML='<strong>'+D.summary.watchlist+' / '+D.summary.watchlist+'</strong><span>watchlist records covered</span>';
$('universe').innerHTML='<span><strong>'+D.summary.protocols+'</strong> protocols observed</span><span><strong>'+D.summary.candidates+'</strong> no token recorded</span><span><strong>'+D.summary.flagged+'</strong> flagged for review</span><span><strong>'+D.summary.live+'</strong> token-bearing references</span><span class="strip-end">One snapshot. Every assumption visible.</span>';
$('source').textContent=D.source;
const cal=D.calibration;
$('calibration-summary').innerHTML='<div><span>Distinct observed peers</span><b>'+cal.peers.length+'</b></div><div><span>Global median mcap / TVL</span><b>'+cal.global.median.toFixed(3)+'×</b></div><div><span>Minimum category cohort</span><b>'+cal.min_peers+' peers</b></div>';
$('method').innerHTML='<p>Token-bearing means symbol OR CoinGecko ID is present. Missing market cap never means no token. All records lacking both identifiers are included; flagged records require further research. Parent relationships are absent from the snapshot.</p><p>Calibration retains positive-cap token records outside asset / custody categories. One record per CoinGecko ID (ticker fallback), choosing largest TVL; this reduces repeated market caps but does not resolve all shared-token identities. Cross-category and nested TVL can overlap.</p><p>Ratios = reported mcap / TVL. Global 10th–90th percentile winsorization clips ratios to <b>'+cal.winsor_low.toFixed(6)+'–'+cal.winsor_high.toFixed(6)+'×</b>. Quartiles and medians use linear interpolation at (n−1)q.</p><p>For category size n ≥ 5, w = n/(n+8) × category influence. Otherwise w = 0. Multiple = exp(w × ln(category median) + (1−w) × ln(global median)).</p><p><code>G = 1 + growthWeight × clamp(7d, −50, 100)/100<br>T = 1 + tenureWeight × (min(days,1095)/1095 − 0.5)<br>base = max(1, round(TVL × multiple × G × T))</code></p><p>Unknown growth or tenure uses a neutral factor 1, visibly remains unknown, and widens the envelope. Tracking days are UTC as_of minus listed_at; future or invalid dates are unknown. The tenure tilt is an assumption, not evidence of tokenless history.</p><p>Low/high use the same log-shrunk peer Q25/Q75, divided / multiplied by U. U = 1.25 + 0.35 for sparse cohorts + 0.20 per missing growth, tenure or category + 0.25 for structure/access flags. This scenario envelope is not a confidence interval; neither zero nor catastrophic losses is excluded.</p><p>All amounts rounded once to integer USD, capped at $100T. TVL is not revenue, enterprise value or token-holder cash flow. Category labels hide business-model differences; depegs and asset prices can move TVL without adoption. Listed market caps are not FDV. No supply or dilution data exists here.</p>';
for(const [id,items] of [['category',[...new Set([...D.rows,...D.live].map(p=>p.category||'Unknown'))]],['chain',[...new Set([...D.rows,...D.live].flatMap(p=>p.chains))]]]){
  items.sort(cmp).forEach(item=>{const o=document.createElement('option');o.value=item;o.textContent=item;$(id).append(o);});
}
function visible(){
 const list=state.status==='recorded'?D.live:current;
 const filtered=list.filter(p=>(state.status==='all'||state.status==='recorded'||p.token_status===state.status)&&(!state.watch||p.watchlist)&&(state.category==='all'||(p.category||'Unknown')===state.category)&&(state.chain==='all'||p.chains.includes(state.chain))&&(!state.q||[p.name,p.slug,p.category,...p.chains,p.symbol,p.gecko_id].join(' ').toLowerCase().includes(state.q)));
 const value=p=>state.key==='implied_value_usd'&&state.status==='recorded'?p.mcap_usd:p[state.key];
 return filtered.sort((a,b)=>{let av=value(a),bv=value(b);if(av==null&&bv==null)return cmp(a.slug,b.slug);if(av==null)return 1;if(bv==null)return -1;return cmp(typeof av==='string'?av.toLowerCase():av,typeof bv==='string'?bv.toLowerCase():bv)*state.direction||cmp(a.slug,b.slug);});
}
function render(){
 const list=visible(),live=state.status==='recorded';
 state.page=Math.min(state.page,Math.max(0,Math.ceil(list.length/pageSize)-1));
 const slice=list.slice(state.page*pageSize,(state.page+1)*pageSize);
 $('rows').innerHTML=slice.map(p=>'<tr data-slug="'+esc(p.slug)+'"><td class="rank">'+(live?'ref':String(p.rank).padStart(2,'0'))+'</td><td><button class="protocol-button" data-slug="'+esc(p.slug)+'">'+(p.watchlist?'<span class="watch-dot" title="Mandatory watchlist record"></span>':'')+esc(p.name)+'</button><div class="protocol-meta">'+(p.flags.length?'<span class="flag-mark" title="Structure or access review">!</span>':'')+esc(p.category||'Unknown')+' · '+esc(p.chains[0]||'Chain unknown')+(p.chains.length>1?' +'+(p.chains.length-1):'')+'</div></td><td class="num tvl">'+money(p.tvl_usd)+'</td><td class="num growth '+(p.change_7d===null?'unknown':p.change_7d>=0?'positive':'negative')+'">'+pct(p.change_7d)+'</td><td class="num tenure '+(p.age_days===null?'unknown':'')+'">'+age(p.age_days)+'</td><td><div class="value-main">'+money(live?p.mcap_usd:p.implied_value_usd)+'</div>'+(live?'<div class="value-range">'+esc(p.symbol||p.gecko_id)+' · recorded</div>':'<div class="value-range">'+money(p.low_usd)+' – '+money(p.high_usd)+'</div><div class="value-track" aria-hidden="true"><i style="left:'+Math.max(0,Math.min(95,100*(p.implied_value_usd-p.low_usd)/Math.max(1,p.high_usd-p.low_usd)))+'%"></i></div>')+'</td></tr>').join('');
 $('empty').hidden=!!list.length;
 $('results').textContent=list.length+' '+(live?'token-bearing references':'candidate records')+(state.watch?' / watchlist':'')+(state.category!=='all'?' / '+state.category:'');
 $('page-info').textContent=list.length?`${state.page*pageSize+1}–${Math.min((state.page+1)*pageSize,list.length)} of ${list.length}`:'0 records';
 $('previous').disabled=state.page===0;$('next').disabled=(state.page+1)*pageSize>=list.length;
 $('value-header').textContent=live?'Reported mcap':'Implied value';
 $('mode-label').textContent=live?'REPORTED / REFERENCE':active()?'SCENARIO / NOT EXPORTED':'BASELINE / EXPORTED';
 $('mode-label').classList.toggle('scenario',active()&&!live);
 document.querySelectorAll('th[data-key]').forEach(th=>{th.removeAttribute('aria-sort');if(th.dataset.key===state.key)th.setAttribute('aria-sort',state.direction===1?'ascending':'descending');const b=th.querySelector('button');b.textContent=b.textContent.replace(/ [↑↓]$/,'')+(th.dataset.key===state.key?(state.direction===1?' ↑':' ↓'):'');});
}
function reset(){state.q='';state.status='all';state.category='all';state.chain='all';state.watch=false;state.key='rank';state.direction=1;state.page=0;$('search').value='';$('status').value='all';$('category').value='all';$('chain').value='all';$('watchlist').checked=false;render();}
$('reset').onclick=reset;$('empty-reset').onclick=reset;
$('search').addEventListener('input',e=>{state.q=e.target.value.trim().toLowerCase();state.page=0;render();});
for(const id of ['status','category','chain']) $(id).addEventListener('change',e=>{state[id]=e.target.value;state.page=0;if(id==='status'){state.key=state.status==='recorded'?'tvl_usd':'rank';state.direction=state.status==='recorded'?-1:1;}render();});
$('watchlist').onchange=e=>{state.watch=e.target.checked;if(state.watch){state.status='all';$('status').value='all';}state.page=0;render();};
$('previous').onclick=()=>{state.page--;render();};$('next').onclick=()=>{state.page++;render();};
document.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{const k=b.dataset.sort;state.direction=state.key===k?-state.direction:k==='name'||k==='rank'?1:-1;state.key=k;state.page=0;render();});
function recalculate(){
 const baseline=new Map(D.rows.map(r=>[r.slug,r]));
 current=D.rows.map(p=>({...p,...M.score(p,D.as_of,cal,state.parameters)})).sort((a,b)=>b.implied_value_usd-a.implied_value_usd||cmp(a.slug,b.slug)).map((p,i)=>({...p,rank:i+1}));
 const moved=current.filter(p=>p.rank!==baseline.get(p.slug).rank).length;
 $('peer-output').value=Math.round(state.parameters.peerWeight*100)+'%';$('growth-output').value=state.parameters.growthWeight.toFixed(2);$('tenure-output').value=state.parameters.tenureWeight.toFixed(2);
 $('scenario-note').textContent=active()?`${moved} of ${current.length} ranks changed. Local scenario only; board.json and baseline remain unchanged.`:'Baseline matches board.json. Sliders recalculate values and ranks across all candidates.';
 render();
}
for(const [id,key] of [['peer-weight','peerWeight'],['growth-weight','growthWeight'],['tenure-weight','tenureWeight']]) $(id).oninput=e=>{state.parameters[key]=Number(e.target.value)/100;recalculate();};
$('restore').onclick=()=>{state.parameters={...M.DEFAULTS};$('peer-weight').value=100;$('growth-weight').value=35;$('tenure-weight').value=20;recalculate();};
function pairs(items){return '<dl class="factor-list">'+items.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl>';}
function openDetail(slug){
 const p=[...current,...D.live].find(p=>p.slug===slug);if(!p)return;
 returnFocus=document.activeElement;state.selected=slug;
 const live=p.token_status==='recorded',base=D.rows.find(r=>r.slug===slug),f=p.model;
 const peers=cal.peers.filter(x=>(x.category||'Unknown')===(p.category||'Unknown'));
 const used=!live&&f.cohort_n>=5;
 const peerList=used?peers:cal.peers;
 const peerRows=[...peerList].sort((a,b)=>Math.abs(Math.log(a.tvl_usd/p.tvl_usd))-Math.abs(Math.log(b.tvl_usd/p.tvl_usd))||cmp(a.slug,b.slug));
 const raw={};for(const k of ['slug','name','category','chains','tvl_usd','change_7d','mcap_usd','listed_at','gecko_id','symbol'])raw[k]=p[k];
 const evidence=live?'<span class="eyebrow">TOKEN-BEARING REFERENCE</span><div class="big-value">'+money(p.mcap_usd)+'</div><p class="detail-small">Reported market cap, not a launch candidate. A symbol or CoinGecko ID is present; missing cap is left unknown.</p>'+pairs([['TVL','$'+exact(p.tvl_usd)],['7d TVL change',pct(p.change_7d)],['Tracking tenure',age(p.age_days)],['Symbol',p.symbol],['CoinGecko ID',p.gecko_id],['Peer eligibility',cal.peers.some(x=>x.slug===p.slug)?'Included in calibration':cal.audit.find(x=>x.slug===p.slug)?.reason||'Not selected']]):
 '<span class="eyebrow">'+(active()?'SCENARIO':'BASELINE')+' MARKET-CAP PROXY</span><div class="big-value">'+money(p.implied_value_usd)+'</div><div class="range-labels"><span>LOW '+money(p.low_usd)+'</span><span>HIGH '+money(p.high_usd)+'</span></div><div class="range-line"><i style="left:'+Math.max(0,Math.min(97,100*(p.implied_value_usd-p.low_usd)/Math.max(1,p.high_usd-p.low_usd)))+'%"></i></div><p class="detail-small">Not FDV or token price. A peer-based scenario range, not a statistical confidence interval.</p>'+pairs([['Snapshot TVL','$'+exact(p.tvl_usd)],['Observed 7d change',p.change_7d===null?'Unknown':p.change_7d+'%'],['Tracking tenure',p.age_days===null?'Unknown':p.age_days+' days'],['Shrunk peer multiple',f.ratio.toFixed(6)+'×'],['Growth factor',f.growth_multiplier.toFixed(6)+'×'],['Tenure factor',f.tenure_multiplier.toFixed(6)+'×'],['Category cohort / weight',f.cohort_n+' / '+(f.category_weight*100).toFixed(1)+'%'],['Exact value','$'+exact(p.implied_value_usd)],['Exported baseline','#'+base.rank+' · $'+exact(base.implied_value_usd)]])+
 '<details class="exact"><summary>Exact arithmetic & uncertainty</summary><code>round('+p.tvl_usd+' × '+f.ratio+' × '+f.growth_multiplier+' × '+f.tenure_multiplier+' × '+f.scale+') = '+p.implied_value_usd+'<br>G input: '+(f.bounded_growth_pct===null?'unknown → neutral factor':f.bounded_growth_pct+'% after −50 / +100 cap')+'<br>U = '+f.uncertainty+'; low = '+p.low_usd+'; high = '+p.high_usd+'</code><ul class="missing-list">'+p.uncertainty_reasons.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></details>';
 const peerHtml='<section class="peer-section"><h3>Comparable evidence</h3><p class="detail-small">'+(used?peers.length+' category peers; blended with global calibration.':peers.length+' eligible category peers; fewer than 5 uses the global median.')+' '+cal.peers.length+' distinct global peers. Table shows '+(used?'the category cohort':'the global fallback cohort')+', nearest TVL first; all peers in this cohort are listed. Ratios are market cap / TVL.</p><div class="peer-scroll"><table class="peer-table"><thead><tr><th>Observed peer</th><th>TVL</th><th>Mcap</th><th>Raw / clipped</th></tr></thead><tbody>'+peerRows.map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+money(x.tvl_usd)+'</td><td>'+money(x.mcap_usd)+'</td><td>'+x.ratio.toFixed(3)+' / '+x.winsor_ratio.toFixed(3)+'×</td></tr>').join('')+'</tbody></table></div><p class="detail-small">Categories are imperfect substitutes. TVL may overlap across protocols and does not measure revenue. Depegs can distort both inputs.</p></section>';
 $('detail-content').innerHTML='<header class="detail-header"><div><span class="eyebrow">RESEARCH FILE / '+esc(p.slug)+' / '+(live?'REFERENCE':'RANK '+p.rank)+'</span><h2 id="detail-title">'+esc(p.name)+'</h2><p>'+esc(p.category||'Category unknown')+' · '+esc(p.chains.join(', ')||'Chains unknown')+'</p></div><button class="close-button" id="close-detail" autofocus>Close × <span class="tiny">Esc</span></button></header><div class="detail-banner"><span>'+ (live?'Token recorded':'No token recorded — existence unverified')+'</span><span>·</span><span>'+p.plan.mode+'</span>'+(p.watchlist?'<span>· Mandatory watchlist</span>':'')+'</div><div class="detail-grid"><section class="detail-section">'+evidence+(live?'':peerHtml)+'</section><section class="detail-section"><h3>Research & farm plan</h3><div class="plan-budget">'+esc(p.plan.capital)+'<br>'+esc(p.plan.fees)+' · '+esc(p.plan.chain)+'<br>'+esc(p.plan.horizon)+' / authored assumptions</div><ol class="steps">'+p.plan.farm_steps.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ol><section class="peer-section"><h3>Record quality</h3><p class="detail-small">'+esc(p.flags.length?p.flags.join('. ')+'.':'No structure flag from available fields. This is not verification of independent token rights.')+' Parent relationships, token supply, revenue, audits and reward terms are absent.</p><details class="raw-data"><summary>Inspect all 10 source fields</summary><pre>'+esc(JSON.stringify(raw,null,2))+'</pre></details></section></section></div><footer class="detail-footer">'+esc(D.source)+'<br>Input SHA-256: '+D.input_sha256+'<br>Tracking dates do not establish founding dates or a history without a token. Proposed actions require independent access and risk checks.</footer>';
 $('close-detail').onclick=()=>$('detail').close();
 if(!$('detail').open)$('detail').showModal();$('detail').scrollTop=0;
}
$('rows').addEventListener('click',e=>{const b=e.target.closest('button[data-slug]');if(b)openDetail(b.dataset.slug);});
$('detail').addEventListener('close',()=>{state.selected=null;if(returnFocus?.isConnected)returnFocus.focus();});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!$('detail').open&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();$('search').focus();}});
render();
})();
