const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const directory = process.env.CHAT_SILHOUETTE_DATA_DIR || path.join(__dirname, '../data/chat-silhouettes');
const {PNG} = require('pngjs');
function list(includeDeleted = false) {
  try { const items = JSON.parse(fs.readFileSync(path.join(directory, 'library.json'), 'utf8')); return includeDeleted ? items : items.filter(item => !item.deletedAt); }
  catch (e) { if (e.code !== 'ENOENT') throw e; return ['wolf','cat','rabbit','dragon'].map(id => ({id,name:id,enabled:true,builtin:true})); }
}
function save(items) {
  fs.mkdirSync(directory, {recursive:true});
  fs.writeFileSync(path.join(directory, 'library.tmp'), JSON.stringify(items));
  fs.renameSync(path.join(directory, 'library.tmp'), path.join(directory, 'library.json'));
  return items;
}
function validateImage(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length > 2*1024*1024 || bytes.length < 24 || bytes.subarray(0,8).toString('hex') !== '89504e470d0a1a0a' || bytes.toString('ascii',12,16) !== 'IHDR' || !bytes.readUInt32BE(16) || !bytes.readUInt32BE(20) || bytes.readUInt32BE(16)>2048 || bytes.readUInt32BE(20)>2048) throw new Error('Upload a PNG up to 2 MB and 2048 × 2048 pixels.');
  for(let offset=8;offset+12<=bytes.length;) { const length=bytes.readUInt32BE(offset); if(bytes.toString('ascii',offset+4,offset+8)==='acTL') throw new Error('Animated PNGs are not supported. Upload a static PNG.'); offset+=length+12; }
  try { PNG.sync.read(bytes, {checkCRC:true}); } catch { throw new Error('The PNG is damaged or unsupported. Please export a static PNG.'); }
  return bytes;
}
function ownerFields(input = {}) {
  const twitchLogin = String(input.twitchLogin || '').trim().toLowerCase();
  const twitchUserId = String(input.twitchUserId || '').trim();
  if (twitchLogin && !/^[a-z0-9_]{1,25}$/.test(twitchLogin)) throw new Error('Enter a Twitch login, not a URL or display name.');
  if (twitchUserId && !/^\d{1,25}$/.test(twitchUserId)) throw new Error('Invalid Twitch user ID.');
  if (twitchUserId && !twitchLogin) throw new Error('A Twitch login is required with an ID.');
  return {twitchLogin,twitchUserId};
}
function deactivatePrevious(items, owner, except) {
  if (!owner.twitchLogin) return;
  for (const item of items) if(item.id !== except && ((owner.twitchUserId && item.twitchUserId === owner.twitchUserId) || item.twitchLogin === owner.twitchLogin)) item.enabled = false;
}
function upload(bytes, metadata = {}) {
  validateImage(bytes);
  const owner = ownerFields(metadata);
  const items=list(true); if(items.filter(item => !item.deletedAt).length>=1000) throw new Error('The library supports 1000 silhouettes.');
  const id=crypto.randomUUID(); fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(path.join(directory,id+'.png'),bytes);
  deactivatePrevious(items, owner, id);
  save([...items,{id,name:owner.twitchLogin ? owner.twitchLogin + ' Chatsona' : 'Custom silhouette',enabled:true,builtin:false,...owner,sourceRequestId:metadata.sourceRequestId || '',discordUserId:metadata.discordUserId || ''}]); return list();
}
function update(id, changes) {
  const items=list(true), item=items.find(item=>item.id===id && !item.deletedAt);
  if(!item) throw new Error('Silhouette not found.');
  if(typeof changes.name !== 'string' || !changes.name.trim() || changes.name.length>80 || typeof changes.enabled !== 'boolean') throw new Error('Enter a name (1–80 characters) and an enabled state.');
  if(changes.species !== undefined && (typeof changes.species !== 'string' || changes.species.length>80)) throw new Error('Species must be up to 80 characters.');
  const owner = ownerFields({...item,...changes});
  if(item.builtin && owner.twitchLogin) throw new Error('Upload an image to assign a viewer Chatsona.');
  if(changes.enabled) deactivatePrevious(items,owner,id);
  Object.assign(item,owner);
  if(changes.species !== undefined) item.species=changes.species.trim();
  item.name=changes.name.trim(); item.enabled=changes.enabled;
  save(items); return list();
}
function remove(id) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Only uploaded images can be deleted. Disable built-in silhouettes instead.');
  const items=list(true), item=items.find(item=>item.id===id);
  if (!item || item.builtin) throw new Error('Uploaded silhouette not found.');
  // Retain a tombstone so approval retries and startup recovery cannot resurrect it.
  item.deletedAt = item.deletedAt || Date.now(); item.enabled = false; save(items);
  try { fs.unlinkSync(path.join(directory,id+'.png')); } catch(e) { if(e.code!=='ENOENT') throw e; }
  return list();
}
function approve(bytes, metadata) {
  const existing = list(true).find(item => item.sourceRequestId === metadata.sourceRequestId);
  if(existing) return existing;
  return upload(bytes,metadata).at(-1);
}
function publicList() { return list().map(({id,name,enabled,builtin,twitchLogin,twitchUserId,species})=>({id,name,enabled,builtin,twitchLogin,twitchUserId,species})); }
module.exports={list,publicList,upload,update,remove,approve,validateImage,ownerFields,directory};
