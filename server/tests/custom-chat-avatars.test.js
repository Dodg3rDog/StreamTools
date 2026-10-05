const { test } = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../../public/widgets/custom-chat/avatars');
const { normalize } = require('../../public/widgets/custom-chat/socket');
test('avatar lookup deduplicates concurrent requests and caches failures', async () => {
 let calls = 0;
 const avatars = create(async () => { calls++; return { ok:true, text: async () => 'https://static-cdn.jtvnw.net/avatar.png' }; });
 const urls = await Promise.all([avatars.get('Viewer'), avatars.get('viewer')]);
 assert.equal(calls,1); assert.equal(urls[0],urls[1]);
 let failures = 0;
 const failed = create(async () => { failures++; throw new Error('offline'); });
 assert.equal(await failed.get('viewer'),''); assert.equal(await failed.get('viewer'),''); assert.equal(failures,1);
 assert.equal(await avatars.get('../bad'),'');
});
test('name colors and logins support both Twitch packet formats', () => {
 const old = normalize({event:{source:'Twitch',type:'ChatMessage'},data:{message:{message:'Hi',username:'viewer',displayName:'Viewer',color:'#9146FF'}}});
 assert.equal(old.data.color,'#9146FF'); assert.equal(old.data.login,'viewer');
 const newer = normalize({event:{source:'Twitch',type:'ChatMessage'},data:{text:'Hi',user:{login:'viewer',name:'Viewer',color:'#00FF00'}}});
 assert.equal(newer.data.color,'#00FF00');
});
