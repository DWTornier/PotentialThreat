// =====================================================================
// TEMPLATE SEQUENCE — copy this file to build a replacement 3D cutscene.
// Live demo: open  index.html?intro=template
//
// CHECKLIST FOR A REPLACEMENT
//  [ ] change id / label / kind
//  [ ] mount():   create renderer, geometry, DOM; append to ctx.root
//  [ ] resize():  use ctx.width/height/dpr (called once right after mount)
//  [ ] update():  advance timeline with dt ONLY (no frame-rate assumptions)
//  [ ] render():  draw exactly one frame; read ctx.theme / ctx.world / ctx.input
//  [ ] dispose(): cancel rAF, remove listeners, remove DOM, free GL resources
//  [ ] register in sequences/index.js  (or via window.PotentialThreatIntro)
//
// RENDER MODE NOTES
//  Canvas2D : canvas.width = ctx.width*ctx.dpr; c.setTransform(dpr,0,0,dpr,0,0)
//             clearRect(0,0,ctx.width,ctx.height). See wireframe.js.
//  WebGL    : kind:'webgl'; new THREE.WebGLRenderer({canvas,alpha:true});
//             renderer.setPixelRatio(ctx.dpr);
//             renderer.setSize(ctx.width,ctx.height,false);
//             dispose(): renderer.dispose(); renderer.forceContextLoss();
//             Three.js may set ownsLoop:true and drive its own rAF.
//  DOM/CSS  : kind:'dom'; render() can be empty; animate CSS vars / transforms.
//             Set managesChrome:true to hide the default title text and draw
//             your own HUD inside ctx.root (give it pointer-events:auto).
//  Hybrid   : canvas background + DOM subtitles via ctx.chrome.setCaption().
// =====================================================================

const V=[];
for(const x of[-1,1])for(const y of[-1,1])for(const z of[-1,1])V.push([x,y,z]);
const E=[[0,1],[1,3],[3,2],[2,0],[4,5],[5,7],[7,6],[6,4],
  [0,4],[1,5],[2,6],[3,7]];

export function createTemplateSequence(){
  let canvas=null,c=null,w=0,h=0,t=0;

  const resize=ctx=>{
    if(!canvas)return;
    w=ctx.width;h=ctx.height;
    canvas.width=Math.max(1,w*ctx.dpr);
    canvas.height=Math.max(1,h*ctx.dpr);
    c.setTransform(ctx.dpr,0,0,ctx.dpr,0,0);
  };

  return {
    id:'template',
    label:'TEMPLATE (COPY ME)',
    kind:'canvas2d',
    looping:true,
    duration:0,
    // For a ONE-SHOT cutscene use:
    //   looping:false, duration:12, inputMode:'skip',
    //   onIntroComplete(ctx){ ctx.chrome.setPress(ctx.theme.press,true); }
    // and call ctx.onIntroComplete() early if your timeline ends sooner.

    mount(ctx){
      canvas=document.createElement('canvas');
      canvas.className='title-canvas';
      ctx.root.appendChild(canvas);
      c=canvas.getContext('2d');
      resize(ctx);
      ctx.chrome.setCaption('TEMPLATE SEQUENCE','REPLACE ME WITH YOUR 3D CUTSCENE');
    },

    resize,

    update(dt){t+=dt;},

    render(ctx){
      if(!c)return;
      c.clearRect(0,0,w,h);
      const S=Math.min(w,h)*0.16;
      const yaw=t*0.5,pitch=0.35;
      const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
      const proj=p=>{
        const x1=p[0]*cy+p[2]*sy,z1=-p[0]*sy+p[2]*cy;
        const y2=p[1]*cp-z1*sp,z2=p[1]*sp+z1*cp;
        const f=4/(4+z2);
        return [w/2+x1*f*S,h*0.42-y2*f*S];
      };
      c.strokeStyle=ctx.theme.colors.cyan;
      c.lineWidth=1.5;
      c.beginPath();
      for(const [i,j] of E){
        const a=proj(V[i]),b=proj(V[j]);
        c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);
      }
      c.stroke();
      ctx.chrome.setCaptionSwap(false);
    },

    dispose(){if(canvas)canvas.remove();canvas=null;c=null;}
  };
}
