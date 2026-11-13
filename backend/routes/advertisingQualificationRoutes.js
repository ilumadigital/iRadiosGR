'use strict';
// No listener-facing routes: authenticated Admin staging diagnostics only.
// This router never charges funds or exposes v2 creatives to public feeds.
const express=require('express');
const router=express.Router();
const {protect}=require('../utils/authMiddleware');
const engine=require('../services/advertisingQualificationEngine');
router.use(protect,(req,res,next)=>
 req.user?.role==='admin'?next():res.status(403).json({error:'Admin required'}));
router.use((req,res,next)=>{
 res.set('Cache-Control','private, no-store');
 return engine.enabled()?next():res.status(404).json({error:'Shadow QA disabled'});
});
router.post('/admin/advertising/shadow/ticket',async(req,res)=>{
 try{
  const {kind,placement}=req.body||{};
  if(!['audio','visual'].includes(kind)||typeof placement!=='string'||
     placement.length>40)
   return res.status(400).json({error:'Invalid placement'});
  const result=await engine.issueShadow({kind,placement,geo:req.geo,req});
  return res.status(result.status==='issued'?201:409).json(result);
 }catch(error){
  console.warn('[AD SHADOW] Issue rejected:',error.message);
  return res.status(400).json({error:'Qualification request rejected'});
 }
});
router.post('/admin/advertising/shadow/heartbeat',async(req,res)=>{
 try{
  const {capability,report}=req.body||{};
  if(typeof capability!=='string'||capability.length>190||
     !report||typeof report!=='object'||Array.isArray(report))
   return res.status(400).json({error:'Invalid observation'});
  return res.json(await engine.heartbeatShadow({req,capability,report}));
 }catch(error){
  console.warn('[AD SHADOW] Heartbeat rejected:',error.message);
  return res.status(400).json({error:'Invalid or stale observation'});
 }
});
module.exports=router;
