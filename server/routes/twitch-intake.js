const router=require('express').Router();
const {requireBearerToken}=require('../middleware/auth');
const intake=require('../services/twitchIntake');
router.post('/command',requireBearerToken,(req,res)=>{res.set('Cache-Control','no-store');try{res.json(intake.command(req.body||{}));}catch{res.status(400).json({error:'Could not create a reply. Please try again shortly.'});}});
module.exports=router;
