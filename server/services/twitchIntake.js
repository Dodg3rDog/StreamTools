const crypto=require('node:crypto');
const store=require('./chatsona/store');
const {getCommissionConfig}=require('./commissionPortal/config');
const {readPricingCatalog,buildPricingSections}=require('./commissionPortal/pricing');
const INVITE='https://discord.gg/gQcRdvDMJA';
const cooldowns=new Map();
function base(){const url=new URL(process.env.CHATSONA_PUBLIC_URL);if(url.protocol!=='https:')throw new Error('Public HTTPS address is not configured.');return url.origin;}
function commissionInfo(){const {catalog}=readPricingCatalog(getCommissionConfig().pricingCatalogPath);return {sections:buildPricingSections(catalog),invite:INVITE};}
function identity(input){const id=String(input.userId||'');const login=String(input.userName||'').toLowerCase();if(!/^\d{1,25}$/.test(id)||!/^[a-z0-9_]{1,25}$/.test(login))throw new Error('Invalid Twitch identity.');return {id,login};}
function issueLink(user){
 const now=Date.now();
 let r=Object.values(store.all()).find(r=>r.source==='twitch'&&r.twitchUserId===user.id&&r.expiresAt>now&&['upload','pending','approving'].includes(r.status));
 if(!r){r=store.create('twitch:'+user.id,process.env.DISCORD_GUILD_ID);Object.assign(r,{source:'twitch',status:'upload',twitchUserId:user.id,twitchLogin:user.login,verifiedAt:now});}
 const token=crypto.randomBytes(32).toString('hex');r.uploadHash=crypto.createHash('sha256').update(token).digest('hex');r.uploadExpires=now+30*60000;r.uploadLinkExpires=r.expiresAt;r.auditPending=true;r.auditEvent='whisper-link-issued';r.updatedAt=now;store.put(r);
 return base()+'/chatsona/upload#'+r.id+'.'+token;
}
function authorized(token,upload=false){
 const [id,key]=String(token||'').split('.');const r=store.get(id);
 const hash=crypto.createHash('sha256').update(key||'').digest('hex');
 if(!r||r.source!=='twitch'||!r.uploadHash||r.expiresAt<Date.now()||r.uploadLinkExpires<Date.now()||!crypto.timingSafeEqual(Buffer.from(hash),Buffer.from(r.uploadHash)))throw new Error('Link expired or invalid. Whisper !chatsona to dodg3r_bot for a new link.');
 if(upload&&(r.status!=='upload'||r.uploadExpires<Date.now()))throw new Error(r.status==='upload'?'Upload link expired. Whisper !chatsona for a new link.':'This request has already been submitted.');
 return r;
}
function command(input){
 const text=String(input.message||'').trim().toLowerCase();
 if(!['!chatsona','!commission','!commissions'].includes(text))return {handled:false};
 const user=identity(input);const key=user.id+':'+text;const now=Date.now();
 for(const [k,time] of cooldowns)if(time<now-60000)cooldowns.delete(k);
 if(cooldowns.has(key))return {handled:true,reply:null};
 let reply;
 if(text==='!chatsona')reply='Upload your Chatsona PNG (2 MB max, 2048 x 2048) within 30 minutes: '+issueLink(user)+' Staff approval is required. Keep this private link to check your review status.';
 else reply='Interested in a commission? Current pricing, options, process and policies: '+base()+'/commission-info Join Discord to discuss your request: '+INVITE;
 cooldowns.set(key,now);return {handled:true,reply};
}
module.exports={command,authorized,issueLink,commissionInfo,INVITE};
