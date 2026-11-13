'use strict';
// Run inside the stage backend container:
//   docker exec iradios_stage-backend-1 node scripts/check-station-media-artwork.cjs
// This checks that Media Session sends the actual colored station logo on white,
// not a text-only placeholder. It reads only the public station catalog.
const {createCanvas,loadImage}=require('canvas');
async function check(){
  const origin='http://127.0.0.1:5011';
  const wanted=process.argv.slice(2).join(' ').trim()||'Music 89.2';
  const list=await fetch(origin+'/api/stations');
  if(!list.ok)throw new Error('Could not fetch public station catalog: '+list.status);
  const stations=await list.json();
  const station=stations.find(s=>s.name?.toLocaleLowerCase('el-GR')===wanted.toLocaleLowerCase('el-GR'));
  if(!station)throw new Error('Station not found in catalog: '+wanted);
  const response=await fetch(origin+'/api/media/station-logo/'+station._id+'.jpg?v=2');
  if(!response.ok)throw new Error('Real logo composition failed: HTTP '+response.status);
  if(!(response.headers.get('content-type')||'').startsWith('image/jpeg'))
    throw new Error('Expected JPEG media artwork');
  const logo=await loadImage(Buffer.from(await response.arrayBuffer()));
  if(logo.width!==512||logo.height!==512)throw new Error('Expected 512x512');
  const canvas=createCanvas(512,512),ctx=canvas.getContext('2d');
  ctx.drawImage(logo,0,0);
  const pixels=ctx.getImageData(0,0,512,512).data;
  const white=(x,y)=>{
    const p=(y*512+x)*4;
    return pixels[p]>235&&pixels[p+1]>235&&pixels[p+2]>235;
  };
  if(!white(8,8)||!white(503,8)||!white(8,503)||!white(503,503))
    throw new Error('White background missing');
  let colored=0;
  for(let p=0;p<pixels.length;p+=4){
    const r=pixels[p],g=pixels[p+1],b=pixels[p+2];
    if(Math.max(r,g,b)-Math.min(r,g,b)>65&&Math.max(r,g,b)>130)colored++;
  }
  if(colored<100)throw new Error('Logo appears grayscale or placeholder (colored pixels='+colored+')');
  console.log('PASS '+wanted+': authentic colored logo on white JPEG, 512x512 ('+colored+' colored pixels)');
}
check().catch(err=>{console.error('FAIL Media artwork:',err.message);process.exitCode=1;});
