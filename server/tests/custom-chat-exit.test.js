const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const model=require('../../public/widgets/custom-chat/model');
test('limit and expiry animate; moderation immediately removes active and exiting nodes',()=>{
 let now=0, listener, tick; const animations=[];
 class Element {
  constructor(){ this.children=[];this.dataset={};this.style={setProperty(){}};this.classList={remove(){},add(){}};this.offsetHeight=30;this.clientHeight=1000; }
  append(...children){for(const c of children){c.parent=this;this.children.push(c)}}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)}
  replaceChildren(){this.children=[]}
  setAttribute(){} addEventListener(){} get childNodes(){return this.children}
  getBoundingClientRect(){return {left:10,top:10,width:200}}
  animate(frames,options){const a={frames,options,cancel(){}};animations.push(a);return a}
 }
 const chat=new Element(),parent={postMessage(){}};
 const context={ChatAudience:require('../../public/widgets/custom-chat/audience'),ChatModel:{...model,Conversation:class extends model.Conversation { add(message){return super.add(message,now)} prune(time=now){return super.prune(time)} }},URL,URLSearchParams,console,Promise,Date:{now:()=>now},location:{search:'?preview=1',origin:'http://test'},parent,
 document:{getElementById:()=>chat,createElement:()=>new Element(),createTextNode:()=>new Element()},
 window:{matchMedia:()=>({matches:false}),addEventListener(type,fn){if(type==='message')listener=fn},setInterval(fn){tick=fn}},setTimeout:()=>1,clearTimeout(){}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../public/widgets/custom-chat/chat.js'),'utf8'),context);
 const send=(type,data)=>listener({origin:'http://test',source:parent,data:{type,data}});
 send('chat-config',{...model.defaults,maxMessages:1,lifetime:1,exitDuration:1200,showAvatars:false});
 const message=id=>({id,name:'A',text:'Hello',platform:'twitch',userId:'a'});
 send('message',message('1'));send('message',message('2'));
 assert.equal(animations.length,1);assert.equal(animations[0].options.duration,1200);assert.equal(animations[0].frames[1].opacity,0);
 assert.equal(chat.children.length,2);
 send('remove',{id:'1',platform:'twitch'});assert.equal(chat.children.length,1);
 now=1100;tick();assert.equal(animations.length,2);
 animations[1].onfinish();assert.equal(chat.children.length,0);
 send('message',message('3'));send('remove',{id:'3',platform:'twitch'});
 assert.equal(animations.length,2);assert.equal(chat.children.length,0);
});
