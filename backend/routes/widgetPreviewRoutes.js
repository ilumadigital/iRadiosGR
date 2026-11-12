'use strict';
const express=require('express');
const {verifyWidgetPreviewToken}=require('../services/widgetPreviewTokens');
const router=express.Router();
// Public verifier returns only allow/deny. It cannot issue tokens, read private
// station data or broaden the unauthenticated embed API.
router.post('/widget-previews/verify',(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('Referrer-Policy','no-referrer');
  const {token,stationId,variant}=req.body||{};
  if(!verifyWidgetPreviewToken({token,stationId,variant}))
    return res.status(403).json({error:'Η προεπισκόπηση έληξε ή δεν είναι έγκυρη.'});
  const decoded=JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString('utf8'));
  const expiresInMs=Math.max(0,Math.min(180000,decoded.exp-Date.now()));
  return res.json({valid:true,expiresInMs});
});
module.exports=router;
