const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'chatsona-recovery-'));process.env.CHATSONA_DATA_DIR=path.join(root,'records');process.env.CHAT_SILHOUETTE_DATA_DIR=path.join(root,'library');process.env.DISCORD_GUILD_ID='guild';
const {PNG}=require('pngjs');const {Collection}=require('discord.js');const bytes=PNG.sync.write(new PNG({width:8,height:8}));
const store=require('../services/chatsona/store');const bot=require('../services/chatsona');const library=require('../services/chatSilhouettes');
test('rebuilds latest records and approved image from bot-authored audit attachments after data loss',async t=>{
 const record={id:'11111111-1111-4111-8111-111111111111',guildId:'guild',userId:'user',status:'approved',createdAt:Date.now(),expiresAt:Date.now()+100000,threadNotified:true,dmNotified:true,reviewClosed:true,twitchLogin:'viewer',twitchUserId:'123',decidedAt:Date.now()};
 const attachment=(name,url)=>({name,url});
 const files=new Map([['https://cdn.discordapp.com/record',Buffer.from(JSON.stringify({version:1,record}))],['https://cdn.discordapp.com/image',bytes]]);
 t.mock.method(global,'fetch',async url=>({ok:true,headers:new Headers(),body:(async function*(){yield files.get(String(url));})()}));
 let calls=0;
 const log={guildId:'guild',messages:{fetch:async()=>++calls===1 ? new Collection([['2',{id:'2',author:{id:'bot'},attachments:new Collection([['a',attachment('chatsona-record.json','https://cdn.discordapp.com/record')],['b',attachment('chatsona.png','https://cdn.discordapp.com/image')]])}]]) : new Collection()}};
 await bot.start({user:{id:'bot'},channels:{fetch:async()=>log}});
 assert.equal(store.get(record.id).status,'approved');assert.deepEqual(store.image(record.id),bytes);assert.equal(library.list().at(-1).twitchUserId,'123');assert.equal(fs.existsSync(store.filename+'.recovering'),false);
});
