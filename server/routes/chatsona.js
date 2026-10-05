const router=require('express').Router();
const oauth=require('../services/chatsona/oauth');
const chatsona=require('../services/chatsona');
router.get('/oauth/callback',async(req,res)=>{
  res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"});
  if(!oauth.configured()) return res.status(503).type('text').send('Chatsona verification is awaiting administrator setup.');
  try {
    const record=await oauth.finish(req.query.code,req.query.state);
    await chatsona.verified(record).catch(()=>{});
    if(/^\d{1,25}$/.test(record.guildId) && /^\d{1,25}$/.test(record.threadId)) {
      return res.redirect(303,`https://discord.com/channels/${record.guildId}/${record.threadId}`);
    }
    res.type('text').send('Twitch account verified. Return to your private Discord thread and upload your PNG.');
  }
  catch(e){res.status(400).type('text').send(e.message);}
});
module.exports=router;
