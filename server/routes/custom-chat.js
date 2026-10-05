const router = require('express').Router();
const { requireBearerToken } = require('../middleware/auth');
const chat = require('../services/customChat');
router.get('/config', (req, res) => res.set('Cache-Control', 'no-store').json({ ok: true, appearance: chat.load().appearance }));
router.get('/events', chat.attach);
router.get('/admin', requireBearerToken, (req, res) => res.set('Cache-Control', 'no-store').json({ ok: true, ...chat.load(), status: chat.getStatus() }));
router.put('/admin', requireBearerToken, (req, res) => {
  try { res.json({ ok: true, ...chat.save(req.body || {}), status: chat.getStatus() }); }
  catch (error) { res.status(400).json({ ok: false, error: error.code ? 'Could not save chat settings.' : error.message }); }
});
module.exports = router;
const library = require('../services/chatSilhouettes');
router.get('/silhouettes', (req,res) => res.set('Cache-Control','no-store').json({items:library.publicList()}));
router.get('/silhouettes/:id.png', (req,res) => {
  if(!/^[a-f0-9-]{36}$/.test(req.params.id)) return res.sendStatus(404);
  if(!library.list().some(item=>item.id===req.params.id)) return res.sendStatus(404);
  res.set('X-Content-Type-Options','nosniff').sendFile(req.params.id+'.png',{root:library.directory});
});
router.post('/silhouettes', requireBearerToken, require('express').raw({type:'image/png',limit:'2mb'}), (req,res) => {
  try { res.json({items:library.upload(req.body,{twitchLogin:req.get('X-Twitch-Login'),twitchUserId:req.get('X-Twitch-User-Id')})}); } catch(e) { res.status(400).json({error:e.code ? 'Could not store silhouette.' : e.message}); }
});
router.put('/silhouettes/:id', requireBearerToken, (req,res) => {
  try { res.json({items:library.update(req.params.id,req.body || {})}); } catch(e) { res.status(400).json({error:e.code ? 'Could not update silhouette.' : e.message}); }
});
router.delete('/silhouettes/:id', requireBearerToken, (req,res) => {
  try { res.json({items:library.remove(req.params.id)}); } catch(e) { res.status(400).json({error:e.code ? 'Could not finish deleting silhouette. Please retry.' : e.message}); }
});
