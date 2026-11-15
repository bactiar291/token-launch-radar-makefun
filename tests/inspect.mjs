import fs from 'node:fs';
const s=JSON.parse(fs.readFileSync('/tmp/makefun/token-radar-01-kit/input/snapshot.json','utf8'));
const counts={};for(const p of s.protocols){const c=p.category??'Unknown';counts[c]??={all:0,noToken:0,peers:0};counts[c].all++;if(!p.symbol&&!p.gecko_id)counts[c].noToken++;else if(p.mcap_usd>0)counts[c].peers++;}
console.log(JSON.stringify({as_of:s.as_of,source:s.source,protocols:s.protocols.length,watchlist:s.watchlist,counts},null,2));
