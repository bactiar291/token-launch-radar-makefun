import fs from 'node:fs';
import {evaluate} from '../lib/research.js';
const input=process.env.FIELD_SNAPSHOT||'/tmp/makefun/campaign-20261117/kits/token-radar-01/verified/token-radar-01-kit/input/snapshot.json';
const artifacts=process.env.FIELD_ARTIFACTS||'/tmp/makefun/campaign-20261117/token-radar-01/artifacts';
const snapshot=JSON.parse(fs.readFileSync(input,'utf8'));
const result=evaluate(snapshot);
fs.mkdirSync(artifacts,{recursive:true});
fs.writeFileSync(artifacts+'/research-metrics.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,cv:undefined,audit:undefined,fit:undefined},null,2));
