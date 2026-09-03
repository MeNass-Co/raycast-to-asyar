#!/usr/bin/env python3
"""inline-icons.py <extensions-dir>: for every installed extension whose manifest icons point at
asyar-extension://<id>/assets/*.png, replace them with 64 px PNG data URIs. The launcher's WKWebView shows
an empty box for asyar-extension:// images in list rows (protocol serves them fine to iframes); data: URIs
are in the CSP img-src and render. Idempotent."""
import base64, glob, io, json, os, sys
from PIL import Image
single = '--single' in sys.argv; root = [a for a in sys.argv[1:] if not a.startswith('--')][0]; done = 0
def uri(path):
    im = Image.open(path).convert('RGBA'); im.thumbnail((64, 64), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
for mf in ([os.path.join(root, 'manifest.json')] if single else glob.glob(os.path.join(root, '*', 'manifest.json'))):
    d = os.path.dirname(mf); m = json.load(open(mf)); ch = False; cache = {}
    def fix(v):
        global ch
        if isinstance(v, str) and v.startswith('asyar-extension://') and v.lower().endswith('.png'):
            rel = v.split('/', 3)[3] if v.count('/') >= 3 else ''; p = os.path.join(d, rel)
            if os.path.exists(p):
                if p not in cache: cache[p] = uri(p)
                ch = True; return cache[p]
        return v
    m['icon'] = fix(m.get('icon'))
    for c in m.get('commands', []): c['icon'] = fix(c.get('icon'))
    if ch: json.dump(m, open(mf, 'w'), indent=1); done += 1
print('inlined icons in', done, 'manifests')
