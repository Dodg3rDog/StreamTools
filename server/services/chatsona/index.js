const {ChannelType,ActionRowBuilder,ButtonBuilder,ButtonStyle,PermissionFlagsBits} = require('discord.js');
const fs=require('node:fs');
const store=require('./store');
const oauth=require('./oauth');
const library=require('../chatSilhouettes');
const CHANNELS={intake:'1554196413758443540',review:'1554195970009464922',log:'682419465560129550'};
let client,ready=false,timer,ticking=false;
const locks=new Set();
const quiet={parse:[]};
const buttons=(id)=>[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('chatsona:approve:'+id).setLabel('Approve').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId('chatsona:deny:'+id).setLabel('Deny').setStyle(ButtonStyle.Danger))];
const verifyButton=id=>[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('chatsona:verify:'+id).setLabel('Verify Discord connection').setStyle(ButtonStyle.Primary))];
async function channel(id) { const ch=await client.channels.fetch(id); if(!ch || ch.guildId!==process.env.DISCORD_GUILD_ID) throw new Error('Chatsona channel is unavailable or belongs to another server.');return ch; }
async function audit(record,event) {
  const safe=store.auditRecord(record);
  const files=[{attachment:Buffer.from(JSON.stringify({version:1,event,record:safe})),name:'chatsona-record.json'}];
  if(['pending','approving','approved'].includes(record.status)) { try { files.push({attachment:store.image(record.id),name:'chatsona.png'}); } catch {} }
  await (await channel(CHANNELS.log)).send({content:'Chatsona '+event+' | '+record.id+' | Discord '+record.userId+' | '+(record.twitchLogin||'not verified'),files,allowedMentions:quiet});
  record.auditPending=false;store.put(record);
}
async function changed(record,event) { record.updatedAt=Date.now();record.auditPending=true;record.auditEvent=event;store.put(record);await audit(record,event).catch(e=>console.warn('[Chatsona] Audit deferred:',e.message)); }
async function threadSend(record,text,components=[]) { const thread=await channel(record.threadId);if(thread.archived) await thread.setArchived(false);await thread.send({content:text,components,allowedMentions:quiet}); }
async function download(url,max=2*1024*1024) {
  const u=new URL(url);if(u.protocol!=='https:' || !['cdn.discordapp.com','media.discordapp.net'].includes(u.hostname)) throw new Error('Only Discord attachments are accepted.');
  const response=await fetch(u,{redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok) throw new Error('Could not download the attachment. Upload it again.');
  if(Number(response.headers.get('content-length'))>max) { await response.body.cancel();throw new Error('Image exceeds 2 MB.'); }
  const chunks=[];let length=0;for await(const chunk of response.body) {length+=chunk.length;if(length>max) throw new Error('Attachment is too large.');chunks.push(chunk);}return Buffer.concat(chunks);
}
async function ensureReview(record) {
  if(record.reviewMessageId) return;
  const review=await channel(CHANNELS.review);
  // Reconcile a successful send if the process stopped before persisting its ID.
  const recent=await review.messages.fetch({limit:100});
  let message=recent.find(m=>m.author.id===client.user.id && m.components.some(row=>row.components.some(b=>b.customId==='chatsona:approve:'+record.id)));
  if(!message) message=await review.send({content:`Chatsona submission\nTwitch: ${record.twitchLogin} (ID ${record.twitchUserId})\nDiscord: ${record.source==='twitch'?'Submitted through Twitch whisper':record.userId}\nRequest: ${record.id}\nApprove to replace this viewer's current Chatsona.`,files:[{attachment:store.image(record.id),name:'chatsona.png'}],components:buttons(record.id),allowedMentions:quiet});
  record.reviewMessageId=message.id;await changed(record,'submitted');
}
async function notifications(record) {
  const errors=[];
  const text=record.status==='approved' ? `Your Chatsona for ${record.twitchLogin} was approved and added to the overlay!` : 'Your Chatsona submission was denied. Contact a moderator if you have questions.';
  if(record.source!=='twitch' && !record.threadNotified && !record.deletedAt && record.expiresAt>Date.now()) { try {await threadSend(record,text);record.threadNotified=true;store.put(record);} catch(e) {if(e.code===10003){record.threadNotified=true;store.put(record);}else errors.push(e);} }
  if(record.source==='twitch' && !record.whisperQueued) {
    const result=await require('../streamerbot').triggerStreamerBot('StreamTools Twitch Whisper',{chatsonaRequestId:record.id,whisperUser:record.twitchLogin,whisperText:text},'[Chatsona whisper]');
    if(result.ok) {record.whisperQueued=true;store.put(record);} else errors.push(new Error('Whisper action unavailable'));
  }
  if(record.source!=='twitch' && !record.dmNotified) {
    try { await (await client.users.fetch(record.userId)).send(text);record.dmNotified=true;store.put(record); }
    catch(e) { if(e.code===50007) {record.dmNotified=true;record.dmBlocked=true;await changed(record,'dm-unavailable');} else errors.push(e); }
  }
  if(record.reviewMessageId && !record.reviewClosed) {
    try {await (await channel(CHANNELS.review)).messages.edit(record.reviewMessageId,{content:`Chatsona ${record.status} | ${record.twitchLogin} | reviewer ${record.reviewerId}`,components:[],allowedMentions:quiet});record.reviewClosed=true;store.put(record);}catch(e){if(e.code===10008){record.reviewClosed=true;store.put(record);}else errors.push(e);}
  }
  if(errors.length) throw errors[0];
}
async function completeApproval(record) {
  const asset=library.approve(store.image(record.id),{twitchLogin:record.twitchLogin,twitchUserId:record.twitchUserId,discordUserId:record.userId,sourceRequestId:record.id});
  record.assetId=asset.id;record.status='approved';await changed(record,'approved');
}
async function handleMessage(message) {
  if(message.author.bot || message.guildId!==process.env.DISCORD_GUILD_ID) return false;
  const command=message.channelId===CHANNELS.intake && /^!chatsona\s*$/i.test(message.content||'');
  if(!ready) {if(command) await message.reply('Chatsona is restoring its records. Please try again shortly.');return command;}
  const record=Object.values(store.all()).find(r=>r.threadId===message.channelId && !r.deletedAt);
  if(!command && !record) return false;
  if(!ready) {await message.reply('Chatsona is restoring its records. Please try again shortly.');return true;}
  const key=message.author.id;if(locks.has(key)) return true;locks.add(key);
  try {
    if(command) {
      const existing=store.active(key);
      if(existing?.threadId) {await message.reply({content:`Your Chatsona thread: <#${existing.threadId}>`,allowedMentions:quiet});return true;}
      const r=existing||store.create(key,message.guildId);
      const thread=await message.channel.threads.create({name:'chatsona-'+key,type:ChannelType.PrivateThread,invitable:false,autoArchiveDuration:1440,reason:'Viewer Chatsona submission'});
      r.threadId=thread.id;r.status='verify';await changed(r,'opened');
      await thread.members.add(key);
      await threadSend(r,'Welcome! Verify your linked Twitch account, then upload one static PNG (maximum 2 MB, 2048 x 2048 pixels). Staff will review it before it appears on stream. This private thread will be deleted seven days after it was opened.',verifyButton(r.id));
      await message.reply({content:`Upload your Chatsona in <#${thread.id}>.`,allowedMentions:quiet});return true;
    }
    if(record.userId!==key) return true;
    if(record.expiresAt<=Date.now()) return true;
    if(record.status==='verify') {await message.reply({content:'Use Verify Discord connection before uploading.',components:verifyButton(record.id)});return true;}
    if(record.status!=='upload') {if(message.attachments.size) await message.reply('This request is already submitted. If review is complete, type !chatsona in the commands channel to submit a replacement.');return true;}
    if(!message.attachments.size) return true;
    if(message.attachments.size!==1) throw new Error('Please upload exactly one PNG image.');
    const attachment=message.attachments.first();if(attachment.size>2*1024*1024) throw new Error('PNG files must be no larger than 2 MB.');
    const bytes=await download(attachment.url);library.validateImage(bytes);store.saveImage(record.id,bytes);
    record.status='pending';record.uploadMessageId=message.id;await changed(record,'received');
    await ensureReview(record);await message.reply('Your image has been sent to staff for approval. The decision will appear here and in a DM.');
  } catch(e) {if(record) await changed(record,'upload-attempt-rejected');await message.reply({content:'Chatsona: '+e.message,allowedMentions:quiet}).catch(()=>{});} finally {locks.delete(key);}return true;
}
function canReview(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ViewChannel);
}

async function handleInteraction(interaction) {
  if(!interaction.isButton() || !interaction.customId.startsWith('chatsona:')) return false;
  const [,action,id]=interaction.customId.split(':');const record=store.get(id);
  await interaction.deferReply({flags:64});
  if(!ready || !record || record.guildId!==interaction.guildId || record.expiresAt<=Date.now()) {await interaction.editReply('This request is unavailable or expired.');return true;}
  if(action==='verify') {
    if(interaction.user.id!==record.userId || interaction.channelId!==record.threadId || record.status!=='verify') {await interaction.editReply('This verification button is only for the request owner before submission.');return true;}
    try {const url=oauth.authorization(record);await interaction.editReply({content:'Authorize Discord to confirm your linked Twitch account. This link expires in 15 minutes.',components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Verify with Discord').setStyle(ButtonStyle.Link).setURL(url))]});}
    catch(e) {await interaction.editReply(e.message);}return true;
  }
  if(!['approve','deny'].includes(action) || interaction.channelId!==CHANNELS.review || interaction.message.id!==record.reviewMessageId || !canReview(interaction)) {await interaction.editReply('Only authorized reviewers can use these buttons in the review channel.');return true;}
  if(record.status!=='pending' || locks.has(id)) {await interaction.editReply('This submission has already been reviewed or is being processed.');return true;}
  locks.add(id);
  try {
    record.status=action==='approve'?'approving':'denied';record.reviewerId=interaction.user.id;record.decidedAt=Date.now();await changed(record,'decision');
    if(action==='approve') await completeApproval(record);
    await notifications(record).catch(e=>console.warn('[Chatsona] Notification deferred:',e.message));
    await interaction.editReply('Submission '+record.status+'.');
  } catch(e) {await interaction.editReply('The decision was saved; delivery will retry. '+e.message);}finally{locks.delete(id);}return true;
}
async function submitWeb(record,bytes) {
  if(!ready) throw new Error('Chatsona is starting. Please try again shortly.');
  if(record.source!=='twitch' || record.status!=='upload' || locks.has(record.id)) throw new Error('This request has already been submitted.');
  locks.add(record.id);
  try {library.validateImage(bytes);store.saveImage(record.id,bytes);record.status='pending';await changed(record,'received');await ensureReview(record).catch(e=>console.warn('[Chatsona] Review delivery deferred:',e.message));}
  finally {locks.delete(record.id);}
}
async function verified(record) {await changed(record,'verified');await threadSend(record,`Verified Twitch account: ${record.twitchLogin}. Upload one PNG here (maximum 2 MB, 2048 x 2048).`);}
async function tick() {
  if(ticking || !ready) return;ticking=true;
  try {for(const r of Object.values(store.all())) {
    if(locks.has(r.id) || locks.has(r.userId)) continue;
    try {
      if(r.auditPending) await audit(r,r.auditEvent||'retry');
      if(r.status==='approving') await completeApproval(r);
      if(r.expiresAt>Date.now() && r.status==='pending') await ensureReview(r);
      if(['approved','denied'].includes(r.status)) await notifications(r).catch(e=>console.warn('[Chatsona] Notification retry:',e.message));
      if(!r.deletedAt && r.threadId && r.expiresAt<=Date.now()) {
        if(!r.cleanupLogged) {r.cleanupLogged=true;await changed(r,'thread-expired');if(r.auditPending) continue;}
        try {await (await channel(r.threadId)).delete('Chatsona seven-day retention expired');} catch(e) {if(e.code!==10003) throw e;}
        r.deletedAt=Date.now();if(['verify','upload','pending'].includes(r.status)) r.status='expired';await changed(r,'thread-deleted');
      } else if(!r.deletedAt && r.threadId) {const thread=await channel(r.threadId);if(thread.archived) await thread.setArchived(false);}
    }catch(e){console.warn('[Chatsona] Retry:',r.id,e.message);}
  }}finally{ticking=false;}
}
async function recover() {
  const marker=store.filename+'.recovering';
  if(fs.existsSync(store.filename) && !fs.existsSync(marker)) return;
  fs.mkdirSync(require('node:path').dirname(store.filename),{recursive:true});fs.writeFileSync(marker,'recovery in progress');
  const log=await channel(CHANNELS.log);let before;const seen=new Set();
  while(true) {
    const batch=await log.messages.fetch({limit:100,...(before?{before}:{})});if(!batch.size) break;
    for(const message of batch.values()) {
      if(message.author.id!==client.user.id) continue;
      const file=message.attachments.find(a=>a.name==='chatsona-record.json');if(!file) continue;
      const data=JSON.parse((await download(file.url,100000)).toString());const r=data.record;
      if(data.version!==1 || !r || !/^[a-f0-9-]{36}$/.test(r.id) || r.guildId!==process.env.DISCORD_GUILD_ID || !Number.isFinite(r.expiresAt) || seen.has(r.id)) continue;
      seen.add(r.id);delete r.oauthHash;delete r.oauthExpires;store.put(r);
      const img=message.attachments.find(a=>a.name==='chatsona.png');if(img){const bytes=await download(img.url);library.validateImage(bytes);store.saveImage(r.id,bytes);}
    }
    before=batch.last().id;
  }
  // Recover the newest approved image for each viewer only if their library entry is missing.
  const owners=new Set();
  for(const r of Object.values(store.all()).sort((a,b)=>(b.decidedAt||0)-(a.decidedAt||0))) {
    if(r.status!=='approved' || owners.has(r.twitchUserId)) continue;owners.add(r.twitchUserId);
    if(!library.list().some(a=>a.twitchUserId===r.twitchUserId)) {try {library.approve(store.image(r.id),{...r,sourceRequestId:r.id,discordUserId:r.userId});}catch(e){console.warn('[Chatsona] Image recovery needs staff:',r.id,e.message);}}
  }
  fs.unlinkSync(marker);
}
function restoreLibrary() {
  const owners=new Set();
  for(const r of Object.values(store.all()).sort((a,b)=>(b.decidedAt||0)-(a.decidedAt||0))) {
    if(r.status!=='approved' || owners.has(r.twitchUserId)) continue;
    owners.add(r.twitchUserId);
    try {
      const assets=library.list();
      const existing=assets.find(a=>a.twitchUserId===r.twitchUserId || a.twitchLogin===r.twitchLogin);
      if(!existing) library.approve(store.image(r.id),{...r,sourceRequestId:r.id,discordUserId:r.userId});
      else if(existing.sourceRequestId===r.id && !fs.existsSync(require('node:path').join(library.directory,existing.id+'.png'))) {
        const bytes=store.image(r.id);library.validateImage(bytes);fs.writeFileSync(require('node:path').join(library.directory,existing.id+'.png'),bytes);
      }
    }catch(e){console.warn('[Chatsona] Asset restore needs staff:',r.id,e.message);}
  }
}
async function start(bot) {
  client=bot;
  try {await recover();restoreLibrary();ready=true;await tick();timer=setInterval(()=>tick().catch(console.error),60000);timer.unref();console.log('[Chatsona] Ready; OAuth configured:',oauth.configured());}
  catch(e){ready=false;console.error('[Chatsona] Startup blocked:',e.message);}
}
module.exports={start,handleMessage,handleInteraction,verified,canReview,download,CHANNELS,tick,submitWeb};
