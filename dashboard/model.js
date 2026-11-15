/* SPDX-License-Identifier: MIT
 * Fieldnote model 1.0. Shared verbatim by Node and the offline classic-script UI.
 * No protocol-specific valuation rules. All amounts are USD market-cap proxies.
 */
(function (root) {
  'use strict';
  const DEFAULTS = Object.freeze({ growthWeight: 0.35, tenureWeight: 0.20, peerWeight: 1, scale: 1 });
  const MIN_PEERS = 5, PRIOR = 8;
  const assetCategories = new Set(['CEX','Bridge','Canonical Bridge','Cross Chain Bridge','Liquid Staking','Liquid Restaking','Restaked BTC','Anchor BTC','Decentralized BTC','Stablecoin Wrapper','Stablecoin Issuer']);
  const accessCategories = new Set(['CEX','RWA','Risk Curators','Onchain Capital Allocator','CeDeFi','Chain','Uncollateralized Lending','OTC Marketplace','Crypto Card Issuer','Payments','Governance Incentives']);
  const cmp = (a,b) => a < b ? -1 : a > b ? 1 : 0;
  const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
  const number = x => typeof x === 'number' && Number.isFinite(x);
  function quantile(values, q) {
    if (!values.length) return null;
    const a = [...values].sort((x,y)=>x-y), at = (a.length-1)*q, i = Math.floor(at);
    return a[i] + (a[Math.min(i+1,a.length-1)]-a[i])*(at-i);
  }
  function dateValue(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const t=Date.parse(s+'T00:00:00Z');
    return Number.isFinite(t) && new Date(t).toISOString().slice(0,10)===s ? t : null;
  }
  function ageDays(asOf, listed) {
    const a=dateValue(asOf), b=dateValue(listed);
    return a===null || b===null || b>a ? null : Math.floor((a-b)/86400000);
  }
  function hasToken(p) { return Boolean(p.symbol || p.gecko_id); }
  function flags(p) {
    const out=[];
    if(assetCategories.has(p.category)) out.push('Possible asset receipt, bridge or custodial product');
    if(/\s(v\d+(\.\d+)?|\d+\.\d+)$/i.test(p.name)) out.push('Versioned record; independent token rights unknown');
    if(/\b(wrapped|staked|staking)\b/i.test(p.name)) out.push('Name suggests wrapped or staking exposure');
    if(/^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)/i.test(p.name)) out.push('Exchange-associated record');
    if(!hasToken(p) && p.mcap_usd!==null) out.push('Market cap present without token identifiers');
    if(accessCategories.has(p.category)) out.push('Access or institutional eligibility must be checked');
    if(!p.category) out.push('Category unreported');
    return out;
  }
  function validateSnapshot(s) {
    if (!s || dateValue(s.as_of)===null || typeof s.source!=='string' || !Array.isArray(s.protocols) || !Array.isArray(s.watchlist)) throw Error('Invalid snapshot envelope');
    const ids=new Set();
    for(const p of s.protocols) {
      if(typeof p.slug!=='string'||!p.slug.length||p.slug.length>128||/\s/.test(p.slug)||ids.has(p.slug)||typeof p.name!=='string'||!p.name.trim()) throw Error('Invalid or duplicate protocol identity');
      if(!Number.isSafeInteger(p.tvl_usd)||p.tvl_usd<=0) throw Error('TVL must be a positive integer: '+p.slug);
      if(!Array.isArray(p.chains)||p.chains.some(c=>typeof c!=='string')) throw Error('Invalid chains');
      for(const k of ['change_7d','mcap_usd']) if(p[k]!==null&&!number(p[k])) throw Error('Invalid numeric field '+k);
      for(const k of ['symbol','gecko_id','category','listed_at']) if(p[k]!==null&&typeof p[k]!=='string') throw Error('Invalid text field '+k);
      ids.add(p.slug);
    }
    if(new Set(s.watchlist).size!==s.watchlist.length || s.watchlist.some(x=>!ids.has(x))) throw Error('Invalid watchlist');
    return s;
  }
  function calibrate(protocols) {
    // One representative per token identity: largest TVL record, not a sum of overlapping versions.
    const identities=new Map(), audit=[];
    for(const p of protocols) {
      if(!hasToken(p)) continue;
      let reason=null;
      if(!(number(p.mcap_usd)&&p.mcap_usd>0)) reason='No positive market cap';
      else if(assetCategories.has(p.category)) reason='Asset / custody category excluded from governance proxy';
      if(reason) { audit.push({slug:p.slug,reason});continue; }
      const key=p.gecko_id ? 'id:'+p.gecko_id.toLowerCase() : 'symbol:'+p.symbol.toUpperCase();
      const prior=identities.get(key);
      if(!prior || p.tvl_usd>prior.tvl_usd || (p.tvl_usd===prior.tvl_usd&&cmp(p.slug,prior.slug)<0)) {
        if(prior) audit.push({slug:prior.slug,reason:'Duplicate token identity; larger TVL representative retained'});
        identities.set(key,p);
      } else audit.push({slug:p.slug,reason:'Duplicate token identity; larger TVL representative retained'});
    }
    const raw=[...identities.values()].sort((a,b)=>cmp(a.slug,b.slug));
    if(!raw.length) throw Error('No observed token-bearing peers with usable market cap');
    const ratios=raw.map(p=>p.mcap_usd/p.tvl_usd);
    const lo=quantile(ratios,.10), hi=quantile(ratios,.90);
    const peers=raw.map(p=>({...p,ratio:p.mcap_usd/p.tvl_usd,winsor_ratio:clamp(p.mcap_usd/p.tvl_usd,lo,hi)}));
    const stats=list=>({n:list.length,median:quantile(list.map(p=>p.winsor_ratio),.5),q25:quantile(list.map(p=>p.winsor_ratio),.25),q75:quantile(list.map(p=>p.winsor_ratio),.75)});
    const global=stats(peers), categories={};
    for(const c of [...new Set(protocols.map(p=>p.category||'Unknown'))].sort(cmp)) categories[c]=stats(peers.filter(p=>(p.category||'Unknown')===c));
    return {peers,audit,global,categories,winsor_low:lo,winsor_high:hi,min_peers:MIN_PEERS,prior:PRIOR};
  }
  function score(p, asOf, calibration, parameters=DEFAULTS) {
    const settings={...DEFAULTS,...parameters}, cohort=calibration.categories[p.category||'Unknown'] || {n:0}, g=calibration.global;
    const weight=cohort.n>=MIN_PEERS ? cohort.n/(cohort.n+PRIOR)*settings.peerWeight : 0;
    const blend=q=>Math.exp(weight*Math.log(cohort[q]||g[q])+(1-weight)*Math.log(g[q]));
    const ratio=blend('median'), age=ageDays(asOf,p.listed_at);
    const bounded=number(p.change_7d)?clamp(p.change_7d,-50,100):null;
    const growth=bounded===null?1:1+settings.growthWeight*bounded/100;
    // Tenure is time in this index, not founding age or verified time without a token.
    const tenure=age===null?1:1+settings.tenureWeight*(Math.min(age,1095)/1095-.5);
    const missing=(bounded===null?1:0)+(age===null?1:0)+(!p.category?1:0);
    const structure=flags(p).length>0;
    const uncertainty=1.25+(cohort.n<MIN_PEERS?.35:0)+missing*.20+(structure?.25:0);
    const round=x=>Math.max(1,Math.min(100000000000000,Math.round(x)));
    const base=p.tvl_usd*ratio*growth*tenure*settings.scale;
    const low=round(p.tvl_usd*Math.min(ratio,blend('q25'))*growth*tenure*settings.scale/uncertainty);
    const high=round(p.tvl_usd*Math.max(ratio,blend('q75'))*growth*tenure*settings.scale*uncertainty);
    return {implied_value_usd:round(base),low_usd:low,high_usd:high,age_days:age,
      model:{ratio,growth_multiplier:growth,tenure_multiplier:tenure,scale:settings.scale,bounded_growth_pct:bounded,category_weight:weight,cohort_n:cohort.n,global_median:g.median,category_median:cohort.median??null,uncertainty,missing_count:missing},
      uncertainty_reasons:[cohort.n<MIN_PEERS?'Sparse category: global fallback':'Category peers remain imperfect substitutes',...(bounded===null?['7d change unknown; neutral factor']:[]),...(age===null?['Tracking tenure unknown; neutral factor']:[]),...(structure?['Structure / access ambiguity']:[]),'Scenario envelope, not a statistical confidence interval']};
  }
  const rangeText=(r,unit='USD')=>r===null?'Unknown':(unit==='USD'?'$':'')+(r[0]===r[1]?r[0]:r[0]+'–'+r[1])+(unit==='min'?' min':'');
  function stepText(s) {
    return `${s.title}: ${s.action} Assumed budget: capital at risk ${rangeText(s.capital_at_risk_usd_range)}; fees ${rangeText(s.estimated_fee_usd_range)}; active ${rangeText(s.time_minutes_range,'min')}. Prerequisite: ${s.prerequisite} Check: ${s.completion_evidence}${s.exit_condition?' Exit: '+s.exit_condition:''}`;
  }
  function farmPlan(p) {
    const c=p.category||'Unknown', chain=[...(p.chains||[])].sort(cmp)[0]||'unreported chain';
    const supported=['Lending','Dexs','Yield','Yield Aggregator','Farm','Liquidity Manager'];
    const monitor=flags(p).length>0||!supported.includes(c)||chain==='unreported chain';
    const knownFee=chain==='Ethereum'?[15,60]:chain==='Solana'?[.2,3]:['Base','Arbitrum','Optimism','Polygon','BSC','Avalanche','Unichain'].includes(chain)?[1,10]:null;
    const capitalRange=monitor?[0,0]:[100,300];
    // Allocate one transaction budget across approval/setup, entry and exit; never repeat the total.
    const allocation=part=>monitor?[0,0]:knownFee?.map(v=>Math.round(v*part*100)/100)??null;
    const step=(title,action,capital,fee,time,prerequisite,completion_evidence,exit_condition=null)=>({title,action,capital_at_risk_usd_range:capital,estimated_fee_usd_range:fee,time_minutes_range:time,prerequisite,completion_evidence,exit_condition,assumption_label:'Authored planning assumption; not a quote or reward promise'});
    let action='If verified, deposit once into one transparent unlevered vault; read strategy loss allocation and withdrawal queue first.';
    let check='Save position receipt, asset amounts and withdrawal terms.';
    let risks='Contract loss, strategy loss, withdrawal queues and asset depegs.';
    if(c==='Lending') { action='If permissionless supply is verified, supply one supported asset once; do not borrow or loop. Check utilization and withdrawal limits.'; check='Save supply receipt, asset balance and withdrawal preview.'; risks='Bad debt, oracle faults, depeg and withdrawal illiquidity.'; }
    if(c==='Dexs'||c==='Liquidity Manager') { action='If verified, simulate then open one small two-asset LP position. Check pool fees, range and impermanent loss; skip if unclear.'; check='Save simulation, both asset amounts and exit quote.'; risks='Impermanent loss, adverse selection, contract faults and depegs.'; }
    const steps=[
      step('Establish identity','Locate official documentation independently; compare token identifiers, contracts and audit scope. No launch or reward is established.',[0,0],[0,0],[30,45],'No wallet connection needed.','Save dated sources and unresolved questions.','Stop on conflicting identity or security warnings.'),
      step('Verify access & exit',monitor?'Check eligibility, jurisdiction, custody, minimums and redemption rights. Closed or unclear access remains research-only.':'Confirm public access, supported assets, chain, lockups and a working withdrawal preview; no route is supplied by this snapshot.',[0,0],[0,0],[20,30],'Identity sources agree.','Record access and exit terms, or mark them unknown.','Unverified terms mean no deposit.'),
      monitor?step('Inspect product risk','Read asset backing, mandate and loss allocation; do not assume a retail deposit route exists.',[0,0],[0,0],[20,30],'Public disclosures available.','Record risks and who can redeem.','Missing disclosure keeps capital at $0.'):
      step('Set a capped budget','Use existing assets on the selected chain. Quote approval, entry and exit together; skip above 5% of pilot capital. No bridging budget is included.',[0,0],allocation(.2),[15,25],'Verified route; quote within cap.','Record quotes; limit approvals to pilot amount.','Unknown fees or extra funding costs: stop and re-budget.'),
      monitor?step('Create a watch record','Save official update sources and unanswered access questions; no wallet interaction or activity farming.',[0,0],[0,0],[10,15],'Identity and disclosure review complete.','A dated research log with next review date.'):
      step('Run one conditional pilot',action,capitalRange,allocation(.4),[20,30],'Access verified; setup budget passed.',check,'Skip if risk or withdrawal mechanics are unclear.'),
      step('Review four times','Review weekly for four weeks; log security, access, withdrawal and reward-term changes. Never manufacture volume.',capitalRange,[0,0],[40,60],'Research log or pilot receipt exists.','Four dated entries; 10–15 active minutes each.',monitor?'Keep capital at $0; reopen only on documented changes.':'Review exit on 10% loss, 2% depeg or security/withdrawal warning.'),
      monitor?step('Close or renew research','After four weeks, archive unresolved eligibility and token rights; renew only with documented new evidence.',[0,0],[0,0],[10,15],'Four reviews complete.','Dated archive or explicit next research question.'):
      step('Exit & reconcile','Request withdrawal after four weeks or an earlier risk trigger; check residual approvals. Lockups can delay settlement.',capitalRange,allocation(.4),[15,25],'Exit reserve retained; terms allow withdrawal.','Save receipt, returned assets and remaining approvals.','Triggers are review rules, not guaranteed stop orders.')
    ];
    const sum=key=>steps.some(s=>s[key]===null)?null:[0,1].map(i=>Math.round(steps.reduce((n,s)=>n+s[key][i],0)*100)/100);
    const totals={capital_at_risk_usd_range:capitalRange,estimated_fee_usd_range:sum('estimated_fee_usd_range'),active_time_minutes_range:sum('time_minutes_range'),review_minutes_range:steps[4].time_minutes_range,review_count:4,elapsed_review_days:28,lockup_days_range:null};
    return {mode:monitor?'Monitor / access check':'Conditional pilot',capital:rangeText(capitalRange)+(monitor?' research only':' reused pilot capital'),fees:rangeText(totals.estimated_fee_usd_range)+(totals.estimated_fee_usd_range?' total fees':' fees; current quote required'),chain,horizon:'4-week review',steps,totals,
      assumptions:'All costs and times are authored planning assumptions, not snapshot facts or returns. Capital is reused, not added per step; fees are separate and allocated once. Review minutes are included in active time. Lockups and settlement time are unknown.',
      risks:monitor?'Custody, legal restrictions, unclear token rights, asset backing and redemption risk.':risks+' Capital can be lost in full.',farm_steps:steps.map(stepText)};
  }
  function build(s, parameters=DEFAULTS) {
    validateSnapshot(s);
    const calibration=calibrate(s.protocols), watch=new Set(s.watchlist);
    const rows=s.protocols.filter(p=>!hasToken(p)).map(p=>{
      const plan=farmPlan(p), f=flags(p);
      return {...p,...score(p,s.as_of,calibration,parameters),watchlist:watch.has(p.slug),token_status:f.length?'ambiguous':'no-record',flags:f,plan,farm_steps:plan.farm_steps};
    }).sort((a,b)=>b.implied_value_usd-a.implied_value_usd||cmp(a.slug,b.slug)).map((p,i)=>({...p,rank:i+1}));
    const live=s.protocols.filter(hasToken).map(p=>({...p,age_days:ageDays(s.as_of,p.listed_at),token_status:'recorded',flags:flags(p),plan:farmPlan(p)})).sort((a,b)=>b.tvl_usd-a.tvl_usd||cmp(a.slug,b.slug));
    if(s.watchlist.some(slug=>!rows.some(p=>p.slug===slug))) throw Error('Watchlist unexpectedly contains a token-bearing record');
    return {version:'fieldnote-1.0',as_of:s.as_of,source:s.source,floor_usd:s.floor_usd,parameters:{...DEFAULTS,...parameters},calibration,rows,live,
      summary:{protocols:s.protocols.length,candidates:rows.length,watchlist:s.watchlist.length,unflagged:rows.filter(p=>!p.flags.length).length,flagged:rows.filter(p=>p.flags.length).length,live:live.length}};
  }
  root.FieldModel={DEFAULTS,MIN_PEERS,PRIOR,quantile,dateValue,ageDays,hasToken,flags,validateSnapshot,calibrate,score,rangeText,stepText,farmPlan,build};
})(globalThis);
