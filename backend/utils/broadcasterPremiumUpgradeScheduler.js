'use strict';
const cron=require('node-cron');
const mongoose=require('mongoose');
const gateway=require('../services/ilumaGatewayClient');
const upgrade=require('../services/broadcasterPremiumUpgrade');
let started=false,running=false;
function ready(){
 return ['staging','production'].includes(process.env.APP_ENV)&&gateway.configured()&&
  mongoose.connection.readyState===1;
}
async function runOnce(now=new Date()){
 if(!ready()||running)return 0;
 running=true;
 try{
  const Job=require('../models/BroadcasterPremiumUpgrade');
  let count=0;
  // Leases prevent two processes from cancelling the same contracts at once.
  for(let i=0;i<6;i++){
   const leaseUntil=new Date(Date.now()+5*60000);
   const job=await Job.findOneAndUpdate({
    environment:process.env.APP_ENV,status:'pending',
    $or:[{leaseUntil:{$lte:now}},{leaseUntil:null}]
   },{$set:{leaseUntil,lastAttemptAt:now}},
   {new:true,sort:{updatedAt:1}}).lean();
   if(!job)break;
   try{await upgrade.processJob(job,now);}
   catch(e){
    console.warn('[BROADCASTER UPGRADE] Cancel worker deferred',
     e.code||e.name||'error');
    await Job.updateOne({_id:job._id,leaseUntil},
     {$set:{leaseUntil:new Date(Date.now()+60000)}});
   }
   count++;
  }
  return count;
 }finally{running=false;}
}
function kick(){
 // Best-effort immediate attempt; durable worker repeats after a restart.
 setImmediate(()=>{runOnce().catch(e=>
  console.warn('[BROADCASTER UPGRADE] Deferred',e.code||e.name||'error'));});
}
function start(){
 if(started||!['staging','production'].includes(process.env.APP_ENV))return;
 started=true;
 cron.schedule('* * * * *',()=>runOnce().catch(e=>
  console.warn('[BROADCASTER UPGRADE] Scan deferred',e.code||e.name||'error')));
}
module.exports={start,kick,runOnce};
