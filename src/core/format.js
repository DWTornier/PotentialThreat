export function fmt(n){
  if(!isFinite(n))return '\u221E';
  const abs=Math.abs(n);
  if(abs<1000){
    const r=Math.round(n*10)/10;
    return Number.isInteger(r)?String(r):r.toFixed(1);
  }
  const units=['K','M','B','T','Qa','Qi','Sx'];
  let u=-1,v=n;
  while(Math.abs(v)>=1000&&u<units.length-1){v/=1000;u++;}
  return v.toFixed(1)+units[u];
}

export function roman(n){
  return ['I','II','III','IV','V','VI','VII','VIII','IX','X'][n-1]||String(n);
}

export function pick(arr){
  return arr[Math.floor(Math.random()*arr.length)];
}
