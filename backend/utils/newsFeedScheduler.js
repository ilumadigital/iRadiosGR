'use strict';
const cron=require('node-cron');
const mongoose=require('mongoose');
const {refreshInBackground}=require('../controllers/newsFeedController');
let started=false;
function run(){
  if(mongoose.connection.readyState!==1)return;
  refreshInBackground().catch(error=>
    console.error('[NEWSFEED] Periodic refresh failed:',String(error?.message||error).slice(0,220)));
}
function start(){
  if(started)return;
  started=true;
  cron.schedule('*/10 * * * *',run);
  // First import immediately after the MongoDB connection, including on server restart.
  mongoose.connection.asPromise().then(run).catch(error=>
    console.error('[NEWSFEED] Initial refresh failed:',String(error?.message||error).slice(0,220)));
}
module.exports={start,run};
