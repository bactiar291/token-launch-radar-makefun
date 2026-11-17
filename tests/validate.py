# SPDX-License-Identifier: MIT
"""Independent checks of the seven published structural gates, not the private scorer."""
import json, re, sys, subprocess, hashlib, stat, os
from pathlib import Path
from html.parser import HTMLParser
from PIL import Image

out=Path(sys.argv[1]).resolve()
snapshot=Path(sys.argv[2] if len(sys.argv)>2 else '/tmp/makefun/campaign-20261117/kits/token-radar-01/verified/token-radar-01-kit/input/snapshot.json')
s=json.loads(snapshot.read_text()); gates={}; details={}
name=re.compile(r'^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$')
net=re.compile(r'https?://',re.I)
class OfflineHTML(HTMLParser):
    def __init__(self): super().__init__(); self.errors=[]; self.style=0; self.script=0; self.scripts=[]
    def handle_starttag(self,tag,attrs):
        for k,v in attrs:
            if v and net.search(v): self.errors.append('network HTML attribute '+k)
        if tag=='style': self.style+=1
        if tag=='script': self.script+=1
    def handle_endtag(self,tag):
        if tag=='style': self.style=max(0,self.style-1)
        if tag=='script': self.script=max(0,self.script-1)
    def handle_data(self,data):
        if self.style and net.search(data): self.errors.append('network inline style')
        if self.script: self.scripts.append(data)
def js_refs(text):
    patterns=[r'\bimport\s*(?:\(\s*)?[\'"]([^\'"]+)',r'\b(?:import|export)\s[^;\n]*?\bfrom\s*[\'"]([^\'"]+)',r'\brequire\s*\(\s*[\'"]([^\'"]+)']
    return [m for pat in patterns for m in re.findall(pat,text) if net.search(m)]
def gate(key,fn):
    try: details[key]=fn();gates[key]=True
    except Exception as e: gates[key]=False;details[key]=str(e)
def dashboard():
    root=out/'dashboard';assert root.is_dir() and not root.is_symlink()
    files=[]
    for p in root.rglob('*'):
        assert not p.is_symlink(),str(p)+' symlink'
        if p.is_dir(): assert not p.name.startswith('.');continue
        assert stat.S_ISREG(p.lstat().st_mode) and name.fullmatch(p.name),str(p)
        files.append(p)
    assert (root/'index.html').is_file() and any(p.suffix=='.css' for p in files) and any(p.suffix=='.js' for p in files)
    size=sum(p.stat().st_size for p in files); assert len(files)<=400 and size<=4194304
    for p in files:
        text=p.read_text(encoding='utf-8')
        if p.suffix=='.html':
            parser=OfflineHTML();parser.feed(text);assert not parser.errors,parser.errors
            assert not js_refs('\n'.join(parser.scripts))
        if p.suffix=='.css': assert not net.search(text),str(p)+' CSS network reference'
        if p.suffix in ('.js','.mjs'): assert not js_refs(text),str(p)+' JS network reference'
    assert size<64000,'Requested dossier source budget exceeded'
    return {'files':len(files),'bytes':size,'offline_references':True,'under_64KB':True}
rows=json.loads((out/'board.json').read_text(encoding='utf-8'))
rows=rows['rows'] if isinstance(rows,dict) else rows
slugs={p['slug'] for p in s['protocols']}
def board():
    assert (out/'board.json').stat().st_size<=8388608
    assert isinstance(rows,list) and 100<=len(rows)<=4000
    seen=set()
    for r in rows:
        assert isinstance(r,dict)
        slug=r['slug'];assert isinstance(slug,str) and 1<=len(slug)<=128 and not re.search(r'\s',slug) and slug in slugs and slug not in seen
        seen.add(slug)
        assert isinstance(r['name'],str) and r['name'].strip()
        assert type(r['rank']) is int and r['rank']>0
        assert type(r['implied_value_usd']) is int and 0<r['implied_value_usd']<=100000000000000
        assert isinstance(r['farm_steps'],list)
    assert len({r['implied_value_usd'] for r in rows})>1
    return {'rows':len(rows),'bytes':(out/'board.json').stat().st_size,'unique_known_slugs':True}
def sorted_values():
    ordered=sorted(rows,key=lambda r:r['rank'])
    assert [r['rank'] for r in ordered]==list(range(1,len(rows)+1))
    assert all(a['implied_value_usd']>=b['implied_value_usd'] for a,b in zip(ordered,ordered[1:]))
    assert len({r['implied_value_usd'] for r in rows})>1
    return 'Ranks exactly 1..N; descending positive integer values'
def coverage():
    count={slug:sum(r['slug']==slug for r in rows) for slug in s['watchlist']};assert all(v==1 for v in count.values())
    return {'covered':len(count),'required':len(s['watchlist']),'exactly_once':True}
def steps():
    lengths=[]
    for r in rows:
        assert 3<=len(r['farm_steps'])<=12
        for text in r['farm_steps']:
            assert isinstance(text,str) and 20<=len(text.strip())<=600
            lengths.append(len(text.strip()))
    return {'min_chars':min(lengths),'max_chars':max(lengths),'steps_per_row':sorted({len(r['farm_steps']) for r in rows})}
def screenshots():
    paths=sorted(p for p in (out/'screenshots').iterdir() if not p.name.startswith('.'))
    assert 3<=len(paths)<=4
    result=[]
    for p in paths:
        assert stat.S_ISREG(p.lstat().st_mode) and not p.is_symlink() and name.fullmatch(p.name)
        assert p.stat().st_size<=524288
        with Image.open(p) as img: fmt=img.format;w,h=img.size;img.verify()
        with Image.open(p) as img:img.load()
        assert fmt in ('JPEG','PNG') and max(w,h)<=1440 and min(w,h)>=800
        data=p.read_bytes()
        if fmt=='JPEG': assert data[:2]==b'\xff\xd8' and data[-2:]==b'\xff\xd9'
        if fmt=='PNG': assert data[-12:]==b'\x00\x00\x00\x00IEND\xaeB`\x82'
        result.append({'name':p.name,'format':fmt,'width':w,'height':h,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    return result
def dossier():
    assert (out/'dossier.json').stat().st_size<=1572864
    run=subprocess.run([os.environ.get('FIELD_NODE','/tmp/makefun/runtime/node-v22.23.5-linux-x64/bin/node'),'tests/dossier.ts',str(out)],cwd=Path(__file__).resolve().parent.parent,env={'PATH':'/usr/bin:/bin'},capture_output=True,text=True)
    assert run.returncode==0,run.stderr
    return json.loads(run.stdout)
for key,fn in [('dashboard_files',dashboard),('board_file',board),('sorted_by_value',sorted_values),('coverage',coverage),('farm_steps',steps),('screenshots',screenshots),('dossier_matches',dossier)]:gate(key,fn)
result={'kind':'independent local published-gate replication; not official score','gates':gates,'details':details,'all_passed':all(gates.values())}
print(json.dumps(result,indent=2))
(out.parent/(out.name+'-validation.json')).write_text(json.dumps(result,indent=2)+'\n')
if not result['all_passed']:raise SystemExit(1)
