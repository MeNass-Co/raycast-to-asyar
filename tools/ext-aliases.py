#!/usr/bin/env python3
"""RETIRED 2026-09-04: trigger matching ships in the rebuilt app and Nassim dislikes these
auto-assigned command aliases (they pin a command above the matching app). Do NOT run this.
Extensions are found by name/trigger now. Kept only for reference.

Original: ext-aliases.py: give each installed converted extension's FIRST view command an alias = a short
extension name (brew, audio, notes…), so typing the extension name finds it today. Asyar allows one alias
per object and unique aliases. Replaced by trigger matching once the rebuilt app ships."""
import json, os, re, sqlite3, time, glob
APP=os.path.expanduser('~/Library/Application Support/org.asyar.app')
con=sqlite3.connect(os.path.join(APP,'asyar_data.db')); n=0
taken={r[0] for r in con.execute('select alias from item_aliases')}
custom={'raycast.benvp.audiodevice':('audio','set-output-device'),'raycast.nhojb.brew':('brew','search'),'raycast.raycast.applenotes':('notes','index'),'raycast.raycast.applereminders':('reminders','my-reminders'),'raycast.thomas.spotifycontrols':('spotify',None),'raycast.helloimsteven.sips':('image',None),'raycast.xilopaint.pdftools':('pdf',None),'raycast.gebeto.translate':('translate','quick-translate'),'raycast.thomaslombart.messages':('messages','my-messages'),'raycast.raycast.mail':('mail',None),'raycast.yug2005.mail':('mail',None),'raycast.raycast.github':('github',None),'raycast.thatnerd.timers':('timer',None),'raycast.loris.things':('things','add-new-todo'),'raycast.notion.notion':('notion',None),'raycast.vimtor.whatsapp':('whatsapp',None),'raycast.antonsuprun.anki':('anki',None),'raycast.reckoningdev.zotero':('zotero',None),'raycast.jarrychung.ghostty':('ghostty',None),'raycast.koinzhang.wifi':('wifi',None),'raycast.tonka3000.speedtest':('speedtest',None),'raycast.lucaschultz.portmanager':('ports',None),'raycast.fezvrasta.emoji':('emoji',None),'raycast.drchai.dictionary':('dictionary',None),'raycast.raycast.browserbookmarks':('bookmarks',None),'raycast.rolandleth.killprocess':('kill',None),'raycast.mooxl.coffee':('coffee',None),'raycast.chrahe.airpodsnoisecontrol':('airpods',None),'raycast.fuksman.calendar':('calendar',None),'raycast.jmaeso.uuidgenerator':('uuid',None),'raycast.melvynx.qrcodegenerator':('qr',None),'raycast.xeric.currencyexchange':('currency',None),'raycast.destiner.jsonformat':('json',None),'raycast.erics118.changecase':('case',None),'raycast.itsmingjie.wordcount':('wordcount',None),'raycast.gastrogeek.foldersearch':('folders',None),'raycast.aayush9029.screenshot':('screenshot',None),'raycast.thomas.colorpicker':('color','pick-color')}
for mf in glob.glob(os.path.join(APP,'extensions','raycast.*','manifest.json')):
    m=json.load(open(mf)); eid=m['id']
    alias,cid=custom.get(eid,(re.sub(r'[^a-z0-9]+','',m['name'].lower()),None))
    if alias in taken: continue
    cmds=m.get('commands',[]); c=next((x for x in cmds if x['id']==cid),None) if cid else None
    c=c or next((x for x in cmds if x.get('mode')=='view'),None) or (cmds[0] if cmds else None)
    if not c: continue
    oid=f"cmd_{eid}_{c['id']}"
    con.execute("insert or replace into item_aliases(object_id,alias,item_name,item_type,created_at) values(?,?,?,?,?)",(oid,alias,c['name'],'command',int(time.time()*1000)))
    taken.add(alias); n+=1
con.commit(); print('aliases set:',n)
