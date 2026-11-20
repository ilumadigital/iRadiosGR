// Pure helpers for the Hero's *actual* audio-frequency visualization.
// The canvas falls back to a static station-colored ambient when browser
// policies or stream CORS prevent safe audio analysis.
export function heroColor(rgb){
  const source=String(rgb||'').trim().split(/\s+/).map(Number);
  return source.length===3&&source.every(n=>Number.isFinite(n)&&n>=0&&n<=255)?
    source.map(n=>Math.round(n)):[134,165,56];
}
export function heroAudioBands(bytes,sampleRate=48000,fftSize=2048){
  if(!bytes?.length)return {bass:0,mid:0,high:0,energy:0};
  const sample=Number.isFinite(sampleRate)&&sampleRate>0?sampleRate:48000;
  const fft=Number.isFinite(fftSize)&&fftSize>0?fftSize:bytes.length*2;
  const sums=[0,0,0],counts=[0,0,0];
  for(let i=1;i<bytes.length;i++){
    const hz=i*sample/fft;
    const band=hz<190?0:hz<1500?1:hz<6800?2:-1;
    if(band<0)continue;
    sums[band]+=bytes[i]/255;counts[band]++;
  }
  const value=index=>counts[index]?Math.min(1,sums[index]/counts[index]):0;
  const bass=value(0),mid=value(1),high=value(2);
  return {bass,mid,high,energy:Math.min(1,bass*.5+mid*.35+high*.15)};
}
export function heroWavePoints(width,height,bass=0,mid=0,high=0,layer=0,phase=0){
  // Geometry in canvas CSS pixels, with bounded modulation for loud streams.
  const w=Math.max(1,width),h=Math.max(1,height);
  const modulation=Math.min(1,Math.max(0,bass*.68+mid*.25+high*.07));
  const scale=h*(.028+.12*modulation)*(1+layer*.28);
  const baseY=h*(.51+layer*.075);
  const points=[];
  const count=80;
  for(let i=0;i<=count;i++){
    const x=w*i/count,t=i/count;
    const envelope=Math.pow(Math.sin(Math.PI*t),.7);
    const wave=Math.sin(t*Math.PI*(2.4+layer*.3)+phase+layer*1.7)*.75+
      Math.sin(t*Math.PI*5.8-phase*.5+layer)*.23;
    points.push([x,baseY+wave*scale*envelope]);
  }
  return points;
}
