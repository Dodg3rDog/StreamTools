const crypto = require('node:crypto');
const store = require('./store');
function configured() {
  try { return new URL(process.env.CHATSONA_PUBLIC_URL).protocol==='https:' && !!process.env.DISCORD_CLIENT_ID && !!process.env.DISCORD_CLIENT_SECRET; } catch { return false; }
}
function redirectUri() { return new URL('/api/chatsona/oauth/callback',process.env.CHATSONA_PUBLIC_URL).href; }
function authorization(record) {
  if(!configured()) throw new Error('Chatsona verification is awaiting administrator setup.');
  const nonce=crypto.randomBytes(32).toString('hex');
  record.oauthHash=crypto.createHash('sha256').update(nonce).digest('hex');record.oauthExpires=Date.now()+15*60000;store.put(record);
  const params=new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID,response_type:'code',scope:'identify connections',redirect_uri:redirectUri(),state:record.id+'.'+nonce,prompt:'consent'});
  return 'https://discord.com/oauth2/authorize?'+params;
}
function consume(state) {
  const [id,nonce]=String(state||'').split('.'); const record=store.get(id);
  if(!record || !record.oauthHash || record.oauthExpires<Date.now() || record.expiresAt<Date.now() || !['verify','upload'].includes(record.status)) throw new Error('This verification link expired. Use Verify in your private thread for a new link.');
  const hash=crypto.createHash('sha256').update(nonce||'').digest('hex');
  if(!crypto.timingSafeEqual(Buffer.from(hash),Buffer.from(record.oauthHash))) throw new Error('Invalid verification link.');
  delete record.oauthHash;delete record.oauthExpires;store.put(record);return record;
}
function twitchConnection(connections) {
  const links=connections.filter(c=>c.type==='twitch' && c.verified && !c.revoked && /^\d{1,25}$/.test(c.id) && /^[a-z0-9_]{1,25}$/i.test(c.name));
  if(links.length!==1) throw new Error('Link one verified Twitch account in Discord Settings > Connections, then try Verify again.');
  return {twitchUserId:links[0].id,twitchLogin:links[0].name.toLowerCase()};
}
async function finish(code,state) {
  const record=consume(state); let token;
  try {
    const response=await fetch('https://discord.com/api/v10/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID,client_secret:process.env.DISCORD_CLIENT_SECRET,grant_type:'authorization_code',code:String(code||''),redirect_uri:redirectUri()}),signal:AbortSignal.timeout(10000)});
    if(!response.ok) throw new Error('Discord authorization failed. Use Verify again.');
    token=(await response.json()).access_token;
    const read=async route=>{const r=await fetch('https://discord.com/api/v10/'+route,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});if(!r.ok) throw new Error('Discord could not verify the account. Try again.');return r.json();};
    const user=await read('users/@me');if(user.id!==record.userId) throw new Error('Sign in to the same Discord account that opened the private thread.');
    const owner=twitchConnection(await read('users/@me/connections'));
    Object.assign(record,owner,{status:'upload',verifiedAt:Date.now()});store.put(record);return record;
  } finally {
    if(token) await fetch('https://discord.com/api/v10/oauth2/token/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID,client_secret:process.env.DISCORD_CLIENT_SECRET,token}),signal:AbortSignal.timeout(10000)}).catch(()=>{});
  }
}
module.exports={configured,authorization,finish,consume,twitchConnection,redirectUri};
