#!/usr/bin/env python3
"""add-triggers.py <extensions-dir> [--single <ext-dir>]: set each converted command's `trigger` to
"<command name> <extension name> <raycast keywords>" so typing the extension name (brew, audio…) finds its
commands, as in Raycast. Reads keywords from the shipped package.json when present. Idempotent."""
import glob, json, os, sys
args=[a for a in sys.argv[1:] if not a.startswith('--')]; single='--single' in sys.argv
dirs=[args[0]] if single else [os.path.dirname(m) for m in glob.glob(os.path.join(args[0],'*','manifest.json'))]
n=0
for d in dirs:
    mf=os.path.join(d,'manifest.json'); m=json.load(open(mf))
    if not str(m.get('id','')).startswith('raycast.'): continue
    pk=os.path.join(d,'package.json'); pkg=json.load(open(pk)) if os.path.exists(pk) else {}
    ext_kw=' '.join(pkg.get('keywords') or [])
    bycmd={c.get('name'):c for c in pkg.get('commands',[])}
    for c in m.get('commands',[]):
        src=bycmd.get(c['id'],{}); kws=' '.join(src.get('keywords') or [])
        c['trigger']=' '.join(x for x in (c['name'], m.get('name',''), pkg.get('title',''), ext_kw, kws) if x).strip()
    json.dump(m,open(mf,'w'),indent=1); n+=1
print('triggers set in',n,'manifests')
