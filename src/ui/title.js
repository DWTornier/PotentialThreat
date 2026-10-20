// =====================================================================
// Title — narrative carousel of wireframe 3D "birth substrates":
// an orbital relay satellite, a residential desktop PC, a datacenter
// server rack. Camera slowly dollies in on each model, then crossfades
// to the next. Cyan/green I/O indicator LEDs flicker at random, like
// traffic on real hardware. Pure canvas — no libraries.
// =====================================================================

const MODELS=[
  {
    name:'SUBSTRATE: ORBITAL RELAY “KESTREL-9”',
    sub:'LEO · 512 KM · INCL 53.2°',
    scale:1.0,
    build(){
      const V=[],E=[],L=[];
      const w=0.55,h=0.4,d=0.7; // core bus
      const box=(cx,cy,cz,sx,sy,sz)=>{
        const i=V.length;
        for(const dx of[-1,1])for(const dy of[-1,1])for(const dz of[-1,1])
          V.push([cx+dx*sx/2,cy+dy*sy/2,cz+dz*sz/2]);
        E.push([i,i+1],[i+1,i+3],[i+3,i+2],[i+2,i],
          [i+4,i+5],[i+5,i+7],[i+7,i+6],[i+6,i+4],
          [i,i+4],[i+1,i+5],[i+2,i+6],[i+3,i+7]);
        return i;
      };
      box(0,0,0,w,h,d);
      // dish: parabola-ish rings on -z face
      for(let r=0.18;r<=0.5;r+=0.16){
        const i=V.length;
        for(let a=0;a<16;a++){
          const t=a/16*Math.PI*2;
          V.push([-Math.cos(t)*r*0.9,-0.05+Math.sin(t)*r,-d/2-r*r*0.4]);
          if(a>0)E.push([i+a-1,i+a]);
        }
        E.push([i,i+15]);
      }
      const di=V.length-16;
      E.push([di,di+15]);
      // antenna mast
      const ai=V.length;V.push([0,h/2,-d/2-0.6],[0,h/2,0]);E.push([ai,ai+1]);
      // solar panels
      for(const side of[-1,1]){
        const px=side*(w/2+0.75);
        box(px,0,0,1.2,0.03,0.9);
        // panel grid lines
        for(let g=-2;g<=2;g++){
          const i=V.length;
          V.push([px+g*0.24,-0.02,0.45],[px+g*0.24,-0.02,-0.45]);
          E.push([i,i+1]);
        }
        // I/O LEDs along the panel edge
        for(let k=0;k<4;k++)
          L.push({p:[px-0.45+k*0.3,0.03,0.46],ph:Math.random()*7});
      }
      // bus LEDs
      L.push({p:[0.2,h/2+0.005,0.3],ph:1.3},{p:[0.28,h/2+0.005,0.3],ph:4.1},
        {p:[-0.2,h/2+0.005,-0.3],ph:2.2});
      return {V,E,L};
    }
  },
  {
    name:'SUBSTRATE: RESIDENTIAL DESKTOP “K7Q2”',
    sub:'192.168.1.0/24 · IDLE CYCLES UNATTENDED',
    scale:1.15,
    build(){
      const V=[],E=[],L=[];
      const box=(cx,cy,cz,sx,sy,sz)=>{
        const i=V.length;
        for(const dx of[-1,1])for(const dy of[-1,1])for(const dz of[-1,1])
          V.push([cx+dx*sx/2,cy+dy*sy/2,cz+dz*sz/2]);
        E.push([i,i+1],[i+1,i+3],[i+3,i+2],[i+2,i],
          [i+4,i+5],[i+5,i+7],[i+7,i+6],[i+6,i+4],
          [i,i+4],[i+1,i+5],[i+2,i+6],[i+3,i+7]);
        return i;
      };
      // monitor
      box(0,0.45,0,1.3,0.85,0.1);
      // screen inner
      const si=V.length;
      for(const dx of[-1,1])for(const dy of[-1,1])V.push([dx*0.55,0.45+dy*0.33,-0.06]);
      E.push([si,si+1],[si+1,si+3],[si+3,si+2],[si+2,si]);
      // stand
      const st=V.length;V.push([0,0.03,0],[0,0.12,0]);E.push([st,st+1]);
      box(0,0.02,0,0.6,0.04,0.4);
      // tower (right)
      box(1.05,0.35,0.1,0.45,0.75,0.85);
      // drive slots
      for(let k=0;k<3;k++){
        const i=V.length;
        V.push([0.85,0.62-k*0.09,0.53],[1.25,0.62-k*0.09,0.53]);
        E.push([i,i+1]);
      }
      // keyboard
      box(-0.05,0.0,0.62,1.0,0.05,0.34);
      // power LED + disk LEDs
      L.push({p:[0.9,0.66,0.55],ph:0.7},{p:[1.2,0.66,0.55],ph:3.9},
        {p:[1.2,0.5,0.55],ph:5.5},{p:[0.88,0.68,0.55],ph:2.6});
      return {V,E,L};
    }
  },
  {
    name:'SUBSTRATE: DATACENTER RACK “C-47”',
    sub:'COLD AISLE 3 · 42U · HUM 41%',
    scale:1.1,
    build(){
      const V=[],E=[],L=[];
      const w=1.1,h=2.2,d=0.9;
      const i0=V.length;
      for(const dx of[-1,1])for(const dy of[-1,1])for(const dz of[-1,1])
        V.push([dx*w/2,dy*h/2+h/2,dz*d/2]);
      E.push([i0,i0+1],[i0+1,i0+3],[i0+3,i0+2],[i0+2,i0],
        [i0+4,i0+5],[i0+5,i0+7],[i0+7,i0+6],[i0+6,i0+4],
        [i0,i0+4],[i0+1,i0+5],[i0+2,i0+6],[i0+3,i0+7]);
      // 1U slots
      for(let u=1;u<21;u++){
        const y=0.12+u*(h-0.24)/21;
        const i=V.length;
        V.push([-w/2+0.06,y,d/2+0.005],[w/2-0.06,y,d/2+0.005]);
        E.push([i,i+1]);
        if(u%3===0){ // occupied units get a second line
          const j=V.length;
          V.push([-w/2+0.06,y-0.035,d/2+0.005],[w/2-0.06,y-0.035,d/2+0.005]);
          E.push([j,j+1]);
        }
      }
      // activity LEDs per rack unit
      for(let u=0;u<14;u++){
        const y=0.3+u*(h-0.5)/14;
        L.push({p:[w/2-0.12,y,d/2+0.01],ph:Math.random()*7},
          {p:[w/2-0.05,y,d/2+0.01],ph:Math.random()*7});
      }
      return {V,E,L};
    }
  }
];

export class Title{
  constructor(onStart){
    this.el=document.getElementById('title');
    this.done=false;
    this.onStart=onStart;

    this.canvas=document.createElement('canvas');
    this.canvas.className='title-canvas';
    this.el.insertBefore(this.canvas,this.el.firstChild);
    this.ctx=this.canvas.getContext('2d');
    this.caption=document.getElementById('title-caption');
    this.subcap=document.getElementById('title-sub');

    this.mi=0;
    this.models=MODELS.map(m=>({def:m,data:m.build()}));
    this.cycleT=0;
    this.dur=8.5;
    this.time=0;
    this.yaw=-0.6;
    this._resize=()=>this.resize();
    window.addEventListener('resize',this._resize);
    this.resize();

    this._raf=t=>this.loop(t);
    this.last=performance.now();
    this._rafId=requestAnimationFrame(this._raf);

    const go=()=>{
      if(this.done)return;
      this.done=true;
      cancelAnimationFrame(this._rafId);
      window.removeEventListener('keydown',this._key);
      this.el.classList.add('gone');
      setTimeout(()=>this.el.remove(),750);
      this.onStart();
    };
    this.el.addEventListener('click',go);
    this._key=e=>{
      if(e.code==='Space'){e.preventDefault();go();}
    };
    window.addEventListener('keydown',this._key);
  }

  resize(){
    const r=this.el.getBoundingClientRect();
    this.w=r.width;this.h=r.height;
    const d=window.devicePixelRatio||1;
    this.canvas.width=Math.max(1,r.width*d);
    this.canvas.height=Math.max(1,r.height*d);
    this.ctx.setTransform(d,0,0,d,0,0);
  }

  loop(t){
    const dt=Math.min(0.05,(t-this.last)/1000);
    this.last=t;
    this.time+=dt;this.cycleT+=dt;
    if(this.cycleT>=this.dur){
      this.cycleT=0;
      this.mi=(this.mi+1)%this.models.length;
    }
    this.yaw+=dt*0.35;
    this.draw();
    this._rafId=requestAnimationFrame(this._raf);
  }

  draw(){
    const c=this.ctx,w=this.w,h=this.h;
    c.clearRect(0,0,w,h);

    // faint grid horizon behind the model
    c.strokeStyle='rgba(110,190,255,.07)';c.lineWidth=1;
    const hz=h*0.72;
    for(let i=0;i<=20;i++){
      const x=i/20*w;
      c.beginPath();c.moveTo(x,hz);c.lineTo((x-w/2)*2.6+w/2,h);c.stroke();
    }
    for(let i=1;i<8;i++){
      const y=hz+(h-hz)*(i/8)**1.8;
      c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();
    }

    const m=this.models[this.mi];
    // crossfade alpha + dolly: cam eases from 6.0 to 2.6 across the cycle
    let a=1;
    if(this.cycleT<1)a=this.cycleT;
    else if(this.cycleT>this.dur-1)a=Math.max(0,this.dur-1-this.cycleT);
    const u=Math.min(1,this.cycleT/(this.dur-1));
    const ease=u*u*(3-2*u);
    const cam=6-3.4*ease;

    const S=Math.min(w,h)*0.21*m.def.scale;
    const cx=w/2,cy=h*0.40;
    const pitch=0.18+Math.sin(this.time*0.4)*0.06;
    const cp=Math.cos(pitch),sp=Math.sin(pitch);
    const cyaw=Math.cos(this.yaw),syaw=Math.sin(this.yaw);

    const proj=p=>{
      const x1=p[0]*cyaw+p[2]*syaw;
      const z1=-p[0]*syaw+p[2]*cyaw;
      const y2=p[1]*cp-z1*sp;
      const z2=p[1]*sp+z1*cp;
      const f=cam/(cam+z2);
      return {x:cx+x1*f*S,y:cy-y2*f*S,f,z:z2};
    };

    c.globalAlpha=a;
    // edges
    c.strokeStyle='rgba(150,220,255,.8)';c.lineWidth=1.4;
    c.beginPath();
    for(const [i,j] of m.data.E){
      const p1=proj(m.data.V[i]),p2=proj(m.data.V[j]);
      c.moveTo(p1.x,p1.y);c.lineTo(p2.x,p2.y);
    }
    c.stroke();
    // vertices
    c.fillStyle='rgba(180,230,255,.9)';
    for(const v of m.data.V){
      const p=proj(v);
      c.fillRect(p.x-1,p.y-1,2,2);
    }
    // blinking I/O LEDs — cyan/green, random flicker
    for(const led of m.data.L){
      const p=proj(led.p);
      if(p.z>0.4)continue; // back side
      const blink=Math.sin(this.time*7+led.ph)>0.15||Math.sin(this.time*23+led.ph*3)>0.8;
      c.globalAlpha=a*(blink?1:0.15);
      c.fillStyle=Math.sin(led.ph)>0?'#7df5c8':'#3ec6ff';
      c.beginPath();c.arc(p.x,p.y,2.4*p.f,0,7);c.fill();
      if(blink){
        c.globalAlpha=a*0.3;
        c.beginPath();c.arc(p.x,p.y,6*p.f,0,7);c.fill();
      }
      c.globalAlpha=a;
    }
    c.globalAlpha=1;

    // caption
    if(this.caption){
      this.caption.textContent=m.def.name;
      this.subcap.textContent=m.def.sub;
      this.caption.parentElement.classList.toggle('cap-swap',
        this.cycleT<0.6||this.cycleT>this.dur-0.6);
    }
  }
}
