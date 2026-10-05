const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Crowd,layout}=require('../../public/widgets/custom-chat/audience');
const {validate}=require('../../public/widgets/custom-chat/model');
const message=id=>({id,userId:id,name:id,platform:'twitch'});
test('crowd preserves chatter identity, caps seats, replaces least recent, and expires idle members',()=>{
 const c=validate({theme:'audience',crowdSize:2,startingCrowd:0,crowdIdle:10});const crowd=new Crowd();
 const a=crowd.touch(message('a'),c,1000);assert.equal(crowd.touch(message('a'),c,2000),a);
 crowd.touch(message('b'),c,3000);assert.equal(crowd.slots.length,2);
 crowd.touch(message('c'),c,4000);assert.equal(crowd.slots.length,2);assert.equal(crowd.slots.some(s=>s.user==='twitch:a'),false);
 crowd.sync(c,20000);assert.equal(crowd.slots.length,0);
});
test('decorative crowd respects cap and random placement is stable per message',()=>{
 const c=validate({crowdSize:3,startingCrowd:10,audiencePlacement:'random'});const crowd=new Crowd();crowd.sync(c);
 assert.equal(crowd.slots.length,3);crowd.touch(message('a'),c);
 assert.equal(crowd.choose(message('a'),c),crowd.choose(message('a'),c));
});
test('nearby bubbles overlap with newest on top without displacing older bubbles',()=>{
 const c=validate({crowdSize:2,startingCrowd:2,characterHeight:100});const crowd=new Crowd();crowd.sync(c);
 const messages=[{...message('a'),audienceSeat:0},{...message('b'),audienceSeat:1}];
 const nodes=new Map(messages.map(m=>['twitch:'+m.id,{style:{setProperty(){}},offsetWidth:220,offsetHeight:120}]));
 const hidden=layout({clientWidth:300,clientHeight:300},nodes,messages,crowd,c);
 assert.equal(hidden.length,0);const newest=nodes.get('twitch:b'),older=nodes.get('twitch:a');assert.ok(parseFloat(newest.style.left)>=c.padding);assert.ok(parseFloat(newest.style.top)>=c.padding);
 assert.equal(older.style.top,newest.style.top);
 assert.ok(Number(newest.style.zIndex)>Number(older.style.zIndex));
 const top=older.style.top;
 layout({clientWidth:300,clientHeight:300},nodes,messages.slice(0,1),crowd,c);
 assert.equal(older.style.top,top);
 assert.equal(layout({clientWidth:300,clientHeight:150},nodes,messages,crowd,c).length,2);
});
test('random positions stay stable, fit the canvas, and permit only modest overlap',()=>{
 const c=validate({crowdSize:20,startingCrowd:20}); const crowd=new Crowd(); crowd.sync(c);
 const positions=crowd.slots.map(s=>crowd.position(s,600,c));
 for(let i=0;i<positions.length;i++) { const p=positions[i]; assert.deepEqual(p,crowd.position(crowd.slots[i],600,c)); assert.ok(p.x-p.size/2>=0); assert.ok(p.x+p.size/2<=600); }
 const sorted=positions.sort((a,b)=>a.x-b.x);
 for(let i=1;i<sorted.length;i++) assert.ok(sorted[i].x-sorted[i-1].x>=sorted[i].size*.7);
});
test('audience groups consecutive chatters but preserves separate turns and moderation',()=>{
 const {Conversation}=require('../../public/widgets/custom-chat/model');
 const c=new Conversation(validate({theme:'audience',lifetime:10}));
 const add=(id,user,text,at)=>c.add({...message(id),userId:user,name:user,text},at);
 add('1','A','Hey how are you',1000); add('2','A','Oh sorry, wrong chat',2000);
 assert.equal(c.messages.length,1); assert.equal(c.messages[0].text,'Hey how are you\nOh sorry, wrong chat');
 c.remove('2','twitch'); assert.equal(c.messages[0].text,'Hey how are you');
 add('3','B','Good evening :D',3000); add('4','A','Good evening :D',4000);
 assert.equal(c.messages.length,2);
 assert.deepEqual(c.messages.map(m=>m.userId),['B','A']);
 assert.equal(c.messages[1].text,'Good evening :D');
 add('5','A','After expiry',20000); assert.equal(c.messages.length,1);assert.equal(c.messages[0].text,'After expiry');
});

test('audience starts a fresh bubble after every three consecutive messages',()=>{
 const {Conversation}=require('../../public/widgets/custom-chat/model');
 const c=new Conversation(validate({theme:'audience',lifetime:0}));
 for(let i=1;i<=7;i++) c.add({...message(String(i)),userId:'same',name:'Same',text:'Line '+i},i*1000);
 assert.deepEqual(c.messages.map(m=>m.parts.length),[1]);
 assert.deepEqual(c.messages.map(m=>m.text),['Line 7']);
});
test('single emotes are enlarged and same-user pyramids are suppressed without affecting others',()=>{
 const {Conversation}=require('../../public/widgets/custom-chat/model');
 const c=new Conversation(validate({theme:'audience',lifetime:0}));let id=0;
 const add=(user,text)=>c.add({...message(String(++id)),name:user,userId:user,text,emotes:[{name:'Kappa',url:'https://example.com/k.png'},{name:'Pog',url:'https://example.com/p.png'}]});
 assert.equal(add('A','Kappa').singleEmote,true);
 assert.equal(add('A','Kappa Kappa'),null);
 assert.equal(add('B','Kappa').singleEmote,true);
 assert.equal(add('A','Kappa Kappa Kappa'),null);
 assert.equal(add('A','Pog').singleEmote,true);
 assert.ok(add('A','hello'));assert.ok(add('A','Kappa'));
 assert.equal(add('C','unknown').singleEmote,false);
 assert.equal(add('D','Kappa Kappa').singleEmote,false);
});
