const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
process.env.CHATSONA_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'whisper-test-'));process.env.CHATSONA_PUBLIC_URL='https://chatsona.example';process.env.DISCORD_GUILD_ID='123';process.env.BEARER_TOKEN='test-only';
const intake=require('../services/twitchIntake');const store=require('../services/chatsona/store');const express=require('express');
test('private upload identity, link rotation, expiry, deduplication and audit redaction',()=>{
 assert.throws(()=>intake.command({message:'!chatsona',userId:'bad',userName:'viewer'}));
 const reply=intake.command({message:'!chatsona',userId:'1234',userName:'Viewer'});const token=reply.reply.match(/#([^ ]+)/)[1];const r=intake.authorized(token,true);assert.equal(r.twitchUserId,'1234');assert.equal(r.twitchLogin,'viewer');
 assert.equal(intake.command({message:'!chatsona',userId:'1234',userName:'viewer'}).reply,null);
 assert.equal(store.auditRecord(r).uploadHash,undefined);
 const replacement=intake.issueLink({id:'1234',login:'viewer'}).split('#')[1];assert.throws(()=>intake.authorized(token));assert.equal(intake.authorized(replacement).id,r.id);
 r.uploadExpires=Date.now()-1;assert.throws(()=>intake.authorized(replacement,true));assert.equal(intake.authorized(replacement).id,r.id);
 r.status='pending';assert.throws(()=>intake.authorized(replacement,true));r.expiresAt=Date.now()-1;assert.throws(()=>intake.authorized(replacement));
 assert.equal(intake.command({message:'hello'}).handled,false);
 const info=intake.command({message:'!commission',userId:'9999',userName:'other'});assert.ok(info.reply.includes('/commission-info'));assert.ok(info.reply.includes(intake.INVITE));assert.ok(info.reply.length<500);
});
test('public pages and token-protected upload API reject unauthorized and cross-origin uploads',async t=>{
 const app=express();app.use(express.json());app.use('/api/twitch',require('../routes/twitch-intake'));app.use(require('../routes/viewer-pages'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());const base='http://127.0.0.1:'+server.address().port;
 let response=await fetch(base+'/api/twitch/command',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,401);
 response=await fetch(base+'/chatsona/upload');assert.equal(response.status,200);assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.ok((await response.text()).includes('Submit for review'));
 response=await fetch(base+'/api/chatsona/upload');assert.equal(response.status,403);
 const token=intake.issueLink({id:'5678',login:'viewer2'}).split('#')[1];const headers={Authorization:'Bearer '+token,'Content-Type':'image/png'};
 response=await fetch(base+'/api/chatsona/upload',{method:'POST',headers,body:'bad'});assert.equal(response.status,403);
 response=await fetch(base+'/api/chatsona/upload',{headers});assert.equal((await response.json()).canUpload,true);
 response=await fetch(base+'/api/chatsona/upload',{method:'POST',headers:{...headers,Origin:'https://chatsona.example'},body:Buffer.alloc(2097153)});assert.equal(response.status,413);
});
