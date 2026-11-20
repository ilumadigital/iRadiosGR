'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../services/adminOtpMail.js'),'utf8');
function fixture(env,accepted=['sales@iluma.gr'],reject=false){
 let options,mail,closed=false;
 const nodemailer={createTransport(opts){
  options=opts;
  return {sendMail:async message=>{
   mail=message;
   if(reject)throw Error('Mailpit unreachable');
   return {accepted};
  },close(){closed=true;}};
 }};
 const module={exports:{}};
 vm.runInNewContext(source,{module,process:{env},require(name){
  if(name==='nodemailer')return nodemailer;
  if(name==='../utils/emailDesign')return{
    renderBrandedEmail(){return '<p>OTP</p>';},
    escapeHtml(value){return String(value).replaceAll('<','&lt;')}
  };
  throw Error('Unexpected require '+name);
 }},{filename:'adminOtpMail.js'});
 return {send:module.exports.sendAdminOtpEmail,
  get options(){return options;},get mail(){return mail;},
  get closed(){return closed;}};
}
test('staging privileged OTP never sends to external SMTP even if configured',async()=>{
 const f=fixture({APP_ENV:'staging',MAIL_FROM:'staging@example.invalid',
  ADMIN_2FA_SMTP_HOST:'external.example',ADMIN_2FA_SMTP_PORT:'465',
  ADMIN_2FA_SMTP_USER:'admin',ADMIN_2FA_SMTP_PASS:'unused',
  ADMIN_2FA_SMTP_FROM:'real@example.org'});
 assert.equal(await f.send({code:'123456',username:'Admin'}),true);
 assert.equal(f.options.host,'mailpit');
 assert.equal(f.options.port,1025);
 assert.equal(f.options.secure,false);
 assert.equal(f.options.ignoreTLS,true);
 assert.equal(f.options.auth,undefined);
 assert.equal(f.mail.to,'sales@iluma.gr');
 assert.equal(f.mail.from,'staging@example.invalid');
 assert.equal(f.closed,true);
});
test('staging Admin OTP fails closed if Mailpit does not accept message',async()=>{
 const rejected=fixture({APP_ENV:'staging'},[]);
 assert.equal(await rejected.send({code:'111111'}),false);
 assert.equal(rejected.closed,true);
 const offline=fixture({APP_ENV:'staging'},[],true);
 await assert.rejects(()=>offline.send({code:'222222'}),/Mailpit unreachable/);
 assert.equal(offline.closed,true);
});
test('non-staging Admin OTP still needs authenticated SMTP',async()=>{
 const f=fixture({APP_ENV:'production'});
 await assert.rejects(()=>f.send({code:'333333'}),/not configured/);
 assert.equal(f.options,undefined);
});
