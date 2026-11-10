'use strict';
// Scan every tracked source/document/config to prevent accidental reintroduction of
// the retired payment processor. The check is offline and does not inspect secrets.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const forbidden='str'+'ipe';
const extensions=new Set(['.js','.jsx','.cjs','.mjs','.json','.html','.css','.sh','.env','.yml','.yaml','.md','.txt','.conf']);
const exclude=new Set(['node_modules','.git','dist','.vite','build','uploads']);
const errors=[];
function walk(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(exclude.has(entry.name))continue;
  const full=path.join(dir,entry.name);
  if(entry.isDirectory()){walk(full);continue;}
  if(!entry.isFile())continue;
  if(!extensions.has(path.extname(entry.name)) && !entry.name.endsWith('.env.example'))continue;
  const source=fs.readFileSync(full,'utf8');
  if(source.toLowerCase().includes(forbidden))
   errors.push(path.relative(root,full));
 }
}
for(const dir of ['backend','frontend','ops','.github'])walk(path.join(root,dir));
for(const extra of ['compose.stage.yml','README.md','STAGING_DEPLOY_GUIDE.md','STAGING_IMPORT_REVIEW.md']){
 const f=path.join(root,extra);
 if(fs.existsSync(f) && fs.readFileSync(f,'utf8').toLowerCase().includes(forbidden))errors.push(extra);
}
if(errors.length){console.error('Retired payment processor remains in source:',errors.join(', '));process.exit(1);}
console.log('No retired payment processor references in application source.');
