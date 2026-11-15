'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
test('baseline Nginx always scrubs user-supplied geo authentication and location',()=>{
 const source=read('ops/nginx-stage.conf');
 const api=source.split('location /api/ {')[1].split('location / {')[0];
 for(const header of ['Auth','Country','Region','Prefecture','City'])
  assert.match(api,new RegExp('proxy_set_header X-Iradios-Geo-'+header+' "";'));
 assert.match(source,/location \^~ \/dev\/mail\/ \{ return 403; \}/);
});
test('optional trusted ingress only emits signed geo from official Cloudflare TCP peers',()=>{
 const nginx=read('ops/nginx-stage-cloudflare-geo.conf');
 const api=nginx.split('location /api/ {')[1].split('location / {')[0];
 for(const name of ['auth','country','region','city'])
  assert.match(api,new RegExp('\\$iradios_stage_geo_'+name));
 assert.match(api,/proxy_set_header X-Iradios-Geo-Prefecture "";/);
 const generator=read('ops/generate-stage-cloudflare-geo.sh');
 assert.match(generator,/https:\/\/www\.cloudflare\.com\/ips-v4/);
 assert.match(generator,/https:\/\/www\.cloudflare\.com\/ips-v6/);
 assert.match(generator,/ipaddress\.ip_network/);
 assert.match(generator,/not network\.is_global/);
 assert.match(generator,/os\.chmod\(tmp,0o600\)/);
 assert.match(generator,/geo \$iradios_stage_cloudflare_edge/);
 assert.match(generator,/map \$iradios_stage_cloudflare_edge \$iradios_stage_geo_auth/);
 assert.match(generator,/1 \$http_cf_ipcountry/);
 assert.match(generator,/1 \$http_cf_region/);
 assert.match(generator,/1 \$http_cf_ipcity/);
 assert.doesNotMatch(generator,/Attica|Αττική/);
});
