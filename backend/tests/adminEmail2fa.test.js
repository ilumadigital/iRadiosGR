'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const secret=process.env.JWT_SECRET;
process.env.JWT_SECRET='z'.repeat(48);
const {issueChallenge,verifyChallenge,RECIPIENT}=require('../services/adminEmail2fa');
const ID='a'.repeat(24);
function fixture(){
 const record={_id:ID,role:'admin',username:'administrator'};
 let emails=[],updates=[];
 function matching(where){
  for(const [key,value] of Object.entries(where)){
   if(key==='$or'){if(!value.some(item=>matching(item)))return false;continue;}
   const actual=record[key];
   if(value&&typeof value==='object'&&!Array.isArray(value)){
    if('$exists' in value){if((actual!==undefined)!==value.$exists)return false;}
    if('$gt' in value&&!(actual>value.$gt))return false;
    if('$lte' in value&&!(actual<=value.$lte))return false;
    if('$lt' in value&&!(actual<value.$lt))return false;
   }else if(String(actual)!==String(value))return false;
  }
  return true;
 }
 function modify(update){
  Object.assign(record,update.$set||{});
  for(const key of Object.keys(update.$unset||{}))delete record[key];
  for(const [key,value] of Object.entries(update.$inc||{}))record[key]=(record[key]||0)+value;
 }
 const User={
  findOneAndUpdate:(q,update)=>({select:async()=>{
   if(!matching(q))return null;modify(update);return {...record};
  }}),
  findOne:q=>({select:async()=>matching(q)?{...record}:null}),
  updateOne:async(q,update)=>{updates.push(update);if(matching(q))modify(update);}
 };
 return {User,record,emails,updates,deliver:async data=>{emails.push(data);return true;}};
}
test('Admin login issues a fresh challenge only for fixed mailbox',async()=>{
 const f=fixture();
 const result=await issueChallenge(f.User,f.record,{deliver:f.deliver});
 assert.equal(RECIPIENT,'sales@iluma.gr');
 assert.equal(result.recipient,RECIPIENT);
 assert.match(result.challenge,/^[a-f0-9]{64}$/);
 assert.match(f.emails[0].code,/^\d{6}$/);
 assert.equal(f.record.adminOtpCodeHash.includes(f.emails[0].code),false);
 await assert.rejects(()=>issueChallenge(f.User,f.record,{deliver:f.deliver}),{code:'ADMIN_2FA_RATE_LIMIT'});
});
test('Wrong codes consume attempts, correct one yields one-use admin2fa token',async()=>{
 const f=fixture();
 const {challenge}=await issueChallenge(f.User,f.record,{deliver:f.deliver});
 await assert.rejects(()=>verifyChallenge(f.User,{challenge,code:'999999'===f.emails[0].code?'111111':'999999'}),{status:401});
 assert.equal(f.record.adminOtpAttempts,1);
 const granted=await verifyChallenge(f.User,{challenge,code:f.emails[0].code},
  claims=>JSON.stringify(claims));
 assert.equal(JSON.parse(granted.token).admin2fa,true);
 await assert.rejects(()=>verifyChallenge(f.User,{challenge,code:f.emails[0].code}),{status:401});
});
test('Expired, exhausted, failed delivery, non-admin and bad input fail closed',async()=>{
 const f=fixture();const {challenge}=await issueChallenge(f.User,f.record,{deliver:f.deliver});
 f.record.adminOtpExpiresAt=new Date(Date.now()-1);
 await assert.rejects(()=>verifyChallenge(f.User,{challenge,code:f.emails[0].code}),{status:401});
 const g=fixture();await assert.rejects(()=>issueChallenge(g.User,g.record,{deliver:async()=>false}),{status:503});
 assert.equal(g.record.adminOtpCodeHash,undefined);
 await assert.rejects(()=>issueChallenge(g.User,{_id:ID,role:'broadcaster'}),{status:403});
 await assert.rejects(()=>verifyChallenge(g.User,{challenge:'no',code:'123456'}),{status:400});
});
after(()=>{if(secret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=secret;});
