'use strict';
// Regression: both billing routers mount at /api and must NEVER enforce JWT
// on /api/auth/login or other public/non-billing routes.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const path=require('node:path');

function readRouter(moduleName,controllerName){
  const target=path.resolve(__dirname,'../backend/routes/'+moduleName+'.js');
  const recorded={use:[],routes:[]};
  const router={
    use(...args){recorded.use.push(args);return router;},
    get(...args){recorded.routes.push(['GET',args[0]]);return router;},
    post(...args){recorded.routes.push(['POST',args[0]]);return router;}
  };
  const original=Module._load;
  Module._load=function(request,parent,isMain){
    if(parent?.filename===target){
      if(request==='express')return {Router:()=>router};
      if(request==='../utils/authMiddleware')return {protect:()=>{}};
      if(request==='../utils/roleMiddleware')return {authorizeRoles:()=>{}};
      if(request===controllerName)return new Proxy({},{get:()=>()=>{}});
    }
    return original.call(this,request,parent,isMain);
  };
  try{
    delete require.cache[target];
    require(target);
  }finally{
    Module._load=original;
    delete require.cache[target];
  }
  return recorded;
}

test('Broadcaster billing guard applies only to broadcaster billing URLs',()=>{
  const got=readRouter('broadcasterBillingRoutes','../controllers/broadcasterBillingController');
  assert.deepEqual(got.use.map(args=>args[0]),['/billing/broadcaster']);
  assert.ok(got.routes.length>=6);
  assert.ok(got.routes.every(([,route])=>route.startsWith('/billing/broadcaster/')));
  assert.equal(got.use.some(([prefix])=>'/auth/login'.startsWith(prefix)),false);
});

test('Listener billing staging environment guard cannot block unrelated API paths',()=>{
  const got=readRouter('billingCheckoutRoutes','../controllers/gatewayBillingController');
  assert.deepEqual(got.use.map(args=>args[0]),
    ['/billing','/admin/billing/sandbox-orders']);
  assert.ok(got.routes.some(([method,route])=>method==='POST' && route==='/billing/checkout'));
  assert.ok(got.routes.some(([method,route])=>method==='GET' && route==='/admin/billing/sandbox-orders'));
  for(const url of ['/auth/login','/auth/register','/stations','/auth/me']){
    assert.equal(got.use.some(([prefix])=>url===prefix||url.startsWith(prefix+'/')),false,
      'Billing guard must not run before '+url);
  }
});
