#!/usr/bin/env python3
"""Seed one "Ask <Extension>" AI extension (an Asyar agent) per installed extension
that declares AI tools — the fallback Nassim approved (2026-09-04) for Raycast's
auto-generated AI extensions. These are PER-EXTENSION and scoped to that extension's
tools; they are NOT the 39 general chat agents he deleted. Each shows in search as
"Ask <Name>" with the Raycast AI-extensions icon and an "AI Extension" label
(icon/label applied by agentsManager). Run with Asyar QUIT.

  python3 seed-ai-extensions.py         # create/update for every tool-bearing extension
  python3 seed-ai-extensions.py --purge # remove every ask-* agent
"""
import json, os, re, sqlite3, sys, time

APP = os.path.expanduser('~/Library/Application Support/org.asyar.app')
DB = os.path.join(APP, 'asyar_data.db')
EXT = os.path.join(APP, 'extensions')
PROVIDER = 'custom_8ee25dd7'   # Nassim's DeepSeek provider (key in settings.dat)
MODEL = 'deepseek-v4-flash'

con = sqlite3.connect(DB)

if '--purge' in sys.argv:
    n = con.execute("delete from agents where id like 'ask-%'").rowcount
    con.commit(); print(f'purged {n} ask-* agents'); sys.exit(0)

def slug(ext_id, name):
    base = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-') or ext_id.split('.')[-1]
    return f'ask-{base}'[:120]

made = []
for d in sorted(os.listdir(EXT)):
    mf = os.path.join(EXT, d, 'manifest.json')
    if not os.path.isfile(mf):
        continue
    m = json.load(open(mf))
    tools = m.get('tools') or []
    if not tools:
        continue
    name = m.get('title') or m.get('name') or d.split('.')[-1].title()
    aid = slug(d, name)
    tool_sel = [f"{d}:{t['id']}" for t in tools if t.get('id')]
    now = int(time.time() * 1000)
    prompt = (f"You are the AI extension for the {name} Raycast extension, running inside Asyar. "
              f"Use only the {name} tools to answer. Be concise. Answer in the language of the question. "
              f"Quote any dates a tool returns as-is.")
    con.execute(
        """insert into agents(id,name,description,system_prompt,provider_id,model_id,tool_selection,
             silent,input_source,output_action,cache_responses,shortcode_trigger,created_at,updated_at)
           values(?,?,?,?,?,?,?,0,'argument','replaceSelection',0,':',?,?)
           on conflict(id) do update set name=excluded.name,description=excluded.description,
             system_prompt=excluded.system_prompt,tool_selection=excluded.tool_selection,updated_at=excluded.updated_at""",
        (aid, f'Ask {name}', f'{name} AI extension: {len(tool_sel)} tools.', prompt,
         PROVIDER, MODEL, json.dumps(tool_sel), now, now))
    made.append((aid, f'Ask {name}', len(tool_sel)))

con.commit()
print(f'seeded {len(made)} AI extensions:')
for aid, nm, n in made:
    print(f'  {nm}  ({n} tools)  [{aid}]')
