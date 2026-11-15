// SPDX-License-Identifier: MIT
import {readFileSync} from 'node:fs';
import {buildDossier} from '../vendor/makefun-board.ts';
const output=process.argv[2];
const expected=Buffer.from(buildDossier(output,{text_max_bytes:65536}));
const actual=readFileSync(output+'/dossier.json');
if(!expected.equals(actual)) throw Error('Dossier differs from exact unmodified buildDossier');
const doc=JSON.parse(actual.toString('utf8'));
if(/\[Cut at|lines not shown/.test(doc.text)) throw Error('Dashboard source is truncated in dossier');
console.log(JSON.stringify({byte_exact:true,dossier_bytes:actual.length,text_bytes:Buffer.byteLength(doc.text),source_untruncated:true,images:doc.images.length}));
