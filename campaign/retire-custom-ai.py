#!/usr/bin/env python3
"""Retire the hand-made "AI Messages & Mail" (extension + MCP server + agent + script trust) now that the
ported Raycast Messages and Mail extensions carry their own AI tools. Also replaces the combined
"Raycast Messages & Mail" agent with one agent per extension. Run with Asyar QUIT."""
import json, os, shutil, sqlite3, time, sys
APP = os.path.expanduser('~/Library/Application Support/org.asyar.app')
MAIL_ID = sys.argv[1] if len(sys.argv) > 1 else 'raycast.yug2005.mail'
MSG_ID = 'raycast.thomaslombart.messages'
p = os.path.join(APP, 'settings.dat'); d = json.load(open(p)); s = d['settings']
for E in ('com.menass.ai-messages-mail',):
    s.setdefault('extensions', {}).setdefault('enabled', {}).pop(E, None); s['extensions'].setdefault('consent', {}).pop(E, None)
    shutil.rmtree(os.path.join(APP, 'extensions', E), ignore_errors=True)
con = sqlite3.connect(os.path.join(APP, 'asyar_data.db'))
con.execute("delete from agents where id in ('ai-messages-mail','raycast-messages-mail')")
for t in ('mcp_servers', 'mcp_permissions', 'mcp_audit', 'mcp_settings'):
    try: con.execute(f"delete from {t} where server_id='ai-local' or id='ai-local'")
    except Exception:
        try: con.execute(f"delete from {t} where id='ai-local'")
        except Exception: pass
con.execute("delete from shell_trusted_binaries where extension_id='com.menass.ai-messages-mail' or binary_path like '%asyar-scripts/ai-messages.sh'")
def agent(aid, name, desc, ext, prompt):
    m = json.load(open(os.path.join(APP, 'extensions', ext, 'manifest.json')))
    tools = [f"{ext}:{t['id']}" for t in m.get('tools', [])]
    now = int(time.time()*1000)
    con.execute("""insert into agents(id,name,description,system_prompt,provider_id,model_id,tool_selection,silent,input_source,output_action,cache_responses,shortcode_trigger,created_at,updated_at)
      values(?,?,?,?,?,?,?,0,'argument','replaceSelection',0,':',?,?)
      on conflict(id) do update set name=excluded.name,description=excluded.description,system_prompt=excluded.system_prompt,tool_selection=excluded.tool_selection,updated_at=excluded.updated_at""",
      (aid, name, desc, prompt, 'custom_8ee25dd7', 'deepseek-v4-flash', json.dumps(tools), now, now))
    return tools
def instr(ext, fallback):
    f = os.path.join(APP, 'extensions', ext, 'rc2asyar-agent.json')
    return (json.load(open(f)).get('instructions') or fallback) if os.path.exists(f) else fallback
today = "Today's date is provided by the system; when a tool returns dates, quote them as-is."
mt = agent('messages', 'Messages', 'Apple Messages: search chats, read the latest messages, count activity, send.', MSG_ID,
           instr(MSG_ID, 'You are a Messages assistant.') + '\n' + today + ' Answer in the language of the question.')
ml = agent('mail', 'Mail', 'Apple Mail: search, read, list accounts and addresses, send, trash, copy links.', MAIL_ID,
           instr(MAIL_ID, 'You are a Mail assistant.') + '\n' + today + ' read-email returns the date; use it when the user asks when.')
s['ai']['defaultAgentId'] = '0e312b74-1abf-4227-ba95-20ba3f23ef83'  # Asyar Assistant
con.commit(); json.dump(d, open(p, 'w'), indent=2)
print('retired custom ext + MCP + combined agent; agents:', 'messages', mt, '|', 'mail', ml)
