// SPDX-License-Identifier: MIT
import { readFileSync, writeFileSync, mkdirSync, cpSync, statSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import './dashboard/model.js';
import { buildDossier } from './vendor/makefun-board.ts';

const root=fileURLToPath(new URL('.',import.meta.url));
const options={input:'/input/snapshot.json',output:process.env.MAKEFUN_OUTPUT_DIR||'/output',prepare:false};
for(let i=2;i<process.argv.length;i++) {
  const arg=process.argv[i];
  if(arg==='--prepare') options.prepare=true;
  else if(arg==='--input'||arg==='--output') {
    const value=process.argv[++i];
    if(!value||value.startsWith('--')) throw Error('Missing value for '+arg);
    options[arg.slice(2)]=value;
  } else throw Error('Unknown argument: '+arg);
}
const input=statSync(options.input).isDirectory()?join(options.input,'snapshot.json'):options.input;
const bytes=readFileSync(input), snapshot=JSON.parse(bytes.toString('utf8'));
const data=globalThis.FieldModel.build(snapshot);
data.input_sha256=createHash('sha256').update(bytes).digest('hex');
const out=resolve(options.output);
if(out===resolve(root)||out===resolve(input)||out===resolve(options.input)) throw Error('Output must be separate from source and input');
mkdirSync(out,{recursive:true});
writeFileSync(join(out,'board.json'),JSON.stringify({schema:'fieldnote/board/v1',as_of:data.as_of,source:data.source,input_sha256:data.input_sha256,model:data.version,parameters:data.parameters,rows:data.rows})+'\n');
writeFileSync(join(out,'data.js'),'window.FIELD_DATA='+JSON.stringify(data).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+';\n');
cpSync(join(root,'dashboard'),join(out,'dashboard'),{recursive:true});
if(!options.prepare) {
  const shots=readdirSync(join(root,'screenshots')).filter(n=>!n.startsWith('.'));
  if(shots.length<3||shots.length>4) throw Error('Final build needs 3–4 actual browser screenshots; --prepare is only for capture bootstrap');
  cpSync(join(root,'screenshots'),join(out,'screenshots'),{recursive:true});
  const dossier=buildDossier(out,{text_max_bytes:65536,screenshots:{max:4,max_bytes:524288},dashboard:{max_files:400,max_bytes:4194304}});
  if(dossier.length>1572864) throw Error('Dossier exceeds bounty 1.5 MiB cap');
  writeFileSync(join(out,'dossier.json'),dossier);
}
console.log(JSON.stringify({output:out,prepared:options.prepare,...data.summary,peers:data.calibration.peers.length,global_median:data.calibration.global.median}));
