'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const installer=fs.readFileSync(path.join(root,'ops/install-stage-geoip2-trust.sh'),'utf8');
const python=installer.split("<<'PY'\n")[1]?.split('\nPY\n')[0];
const sampleSite=`
server {
    listen 80;
    server_name stage.iradios.gr;
    location / { return 301 https://stage.iradios.gr$request_uri; }
}
server {
    listen 443 ssl;
    server_name stage.iradios.gr;
    location = /api/proxy-stream {
        proxy_pass http://127.0.0.1:5511;
        proxy_set_header Host $host;
    }
    location ^~ /api/connect.io {
        proxy_pass http://127.0.0.1:5511;
    }
    location /api/ {
        proxy_pass http://127.0.0.1:5511;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    location / {
        proxy_pass http://127.0.0.1:5510;
    }
}
`;
const sampleGeo=`geoip2 /var/lib/GeoIP/GeoLite2-City.mmdb {
    auto_reload 5m;
    $iradios_geo_country source=$remote_addr country iso_code;
    $iradios_geo_region_name source=$remote_addr subdivisions 0 names en;
    $iradios_geo_city source=$remote_addr city names en;
}
`;
function fixture(secret='0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'iradios-geoip2-'));
 const site=path.join(dir,'stage-site.conf');
 const geo=path.join(dir,'geoip2.conf');
 const trust=path.join(dir,'trusted.conf');
 const env=path.join(dir,'backend.env');
 fs.writeFileSync(site,sampleSite); fs.writeFileSync(geo,sampleGeo);
 fs.writeFileSync(env,'APP_ENV=staging\nIRADIOS_TRUSTED_GEO_SECRET='+secret+'\n');
 return {dir,site,geo,trust,env,secret};
}
test('installer enforces separate backend secret, no financial activity, and no real-ip rewrite',()=>{
 for(const expected of ['ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=1',
  "APP_ENV=staging","real_ip_header|set_real_ip_from",
  "nginx -t","systemctl reload nginx","restore_on_error",
  "proxy_pass","set -Eeuo pipefail"])assert.ok(installer.includes(expected),expected);
 assert.ok(python?.includes('os.O_EXCL'));
});
test('installer generates safe root-only Nginx map and overwrites every upstream geo header',()=>{
 const f=fixture();
 try{
  cp.execFileSync('python3',['-',f.site,f.geo,f.trust,f.env],{input:python});
  const site=fs.readFileSync(f.site,'utf8');
  const map=fs.readFileSync(f.trust,'utf8');
  const geo=fs.readFileSync(f.geo,'utf8');
  assert.match(map,/map \$iradios_geo_country \$iradios_geo_auth_header/);
  assert.match(map,/default "";\n\s+GR "/);
  assert.ok(map.includes(f.secret));
  assert.equal(fs.statSync(f.trust).mode & 0o777,0o600);
  assert.ok(!site.includes(f.secret));
  assert.match(site,/location \/api\/ \{[\s\S]*?proxy_set_header X-Iradios-Geo-Auth \$iradios_geo_auth_header;/);
  assert.match(site,/proxy_set_header X-Iradios-Geo-Prefecture "";/);
  assert.match(site,/proxy_set_header X-Iradios-Geo-Accuracy-Km \$iradios_geo_accuracy_km;/);
  assert.equal((site.match(/proxy_set_header X-Iradios-Geo-Auth "";/g)||[]).length,2);
  assert.match(geo,/\$iradios_geo_accuracy_km source=\$remote_addr location accuracy_radius;/);
  assert.equal((geo.match(/\$iradios_geo_accuracy_km/g)||[]).length,1);
  assert.match(site,/location \/ \{\n\s+proxy_pass http:\/\/127\.0\.0\.1:5510;\n\s+\}/);
 }finally{fs.rmSync(f.dir,{recursive:true,force:true});}
});
test('installer refuses unsafe keys and does not fabricate a trusted Nginx map',()=>{
 const f=fixture('abc";\nset $hacked 1;');
 try{
  assert.throws(()=>cp.execFileSync('python3',['-',f.site,f.geo,f.trust,f.env],
    {input:python,stdio:['pipe','ignore','ignore']}));
  assert.equal(fs.readFileSync(f.site,'utf8'),sampleSite);
  assert.ok(!fs.existsSync(f.trust));
 }finally{fs.rmSync(f.dir,{recursive:true,force:true});}
});
test('installer refuses unexpected sites instead of injecting into wrong upstream',()=>{
 const f=fixture();
 try{
  fs.writeFileSync(f.site,sampleSite.replace('127.0.0.1:5511','127.0.0.1:9911')
    .replace('location /api/ {','location /foo/ {'));
  assert.throws(()=>cp.execFileSync('python3',['-',f.site,f.geo,f.trust,f.env],
    {input:python,stdio:['pipe','ignore','ignore']}));
 }finally{fs.rmSync(f.dir,{recursive:true,force:true});}
});
