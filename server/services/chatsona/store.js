const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const directory = process.env.CHATSONA_DATA_DIR || path.join(__dirname,'../../data/discord/chatsona');
const filename = path.join(directory,'requests.json');
let records;
function all() {
  if(!records) {
    try { records=JSON.parse(fs.readFileSync(filename,'utf8')); }
    catch(e) { if(e.code!=='ENOENT') throw e; records={}; }
  }
  return records;
}
function flush() {
  fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(filename+'.tmp',JSON.stringify(all(),null,2));
  fs.renameSync(filename+'.tmp',filename);
}
function put(record) { all()[record.id]=record; flush(); return record; }
function create(userId,guildId) {
  const now=Date.now();
  return put({id:crypto.randomUUID(),userId,guildId,status:'creating',createdAt:now,expiresAt:now+7*86400000});
}
function get(id) { return all()[id]; }
function active(userId) { return Object.values(all()).find(r=>r.userId===userId && !r.deletedAt && r.expiresAt>Date.now() && ['creating','verify','upload','pending','approving'].includes(r.status)); }
function pendingPath(id) { if(!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid request ID'); return path.join(directory,id+'.png'); }
function saveImage(id,bytes) { fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(pendingPath(id),bytes); }
function image(id) { return fs.readFileSync(pendingPath(id)); }
function auditRecord(record) { const {oauthHash,oauthExpires,uploadHash,uploadExpires,uploadLinkExpires,...safe}=record; return safe; }
module.exports={all,put,create,get,active,saveImage,image,auditRecord,filename};
