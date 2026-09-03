#!/usr/bin/env python3
"""Seed Raycast's official AI chat presets (ray.so/presets, verbatim instructions) as Asyar chat agents.
Presets that need Raycast-only tools (calendar/linear/github MCPs) are seeded without tools.
Run with Asyar quit (direct DB write); idempotent upsert by id `rc-preset-<slug>`."""
import json, os, re, sqlite3, time
DB = os.path.expanduser('~/Library/Application Support/org.asyar.app/asyar_data.db')
PROVIDER, MODEL = 'custom_8ee25dd7', 'deepseek-v4-flash'
presets = json.load(open(os.path.join(os.path.dirname(__file__), 'raycast-presets.json')))
con = sqlite3.connect(DB); now = int(time.time() * 1000); n = 0
for p in presets:
    slug = re.sub(r'[^a-z0-9]+', '-', p['name'].lower()).strip('-')
    aid = f'rc-preset-{slug}'
    desc = (p['description'] or f"Raycast preset ({p['group']})").strip()
    con.execute("""insert into agents(id,name,description,system_prompt,provider_id,model_id,tool_selection,silent,input_source,output_action,cache_responses,shortcode_trigger,created_at,updated_at)
      values(?,?,?,?,?,?,'[]',0,'argument','replaceSelection',0,':',?,?)
      on conflict(id) do update set name=excluded.name,description=excluded.description,system_prompt=excluded.system_prompt,updated_at=excluded.updated_at""",
      (aid, p['name'], desc, p['instructions'].strip(), PROVIDER, MODEL, now, now))
    n += 1
con.commit(); print(n, 'presets seeded;', con.execute("select count(*) from agents where id like 'rc-preset-%'").fetchone()[0], 'present')
