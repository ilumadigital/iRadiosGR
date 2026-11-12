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
  return res.json({valid:true});
});
module.exports=router;
