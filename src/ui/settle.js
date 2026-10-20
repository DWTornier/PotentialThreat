import { fmt } from '../core/format.js';

// =====================================================================
// Settle — GAME OVER / SINGULARITY settlement screen.
// Retro CRT post-mortem: cause of termination, run stats typed in
// line-by-line, then a reboot prompt. Restart = full reinit via reload
// (module state is intentionally non-persistent: "deletion is deletion").
// =====================================================================

const $=id=>document.getElementById(id);

export class Settle{
  constructor(){
    this.el=$('settle');
    this.el.classList.add('hidden');
    this.shown=false;
    $('settle-reboot').addEventListener('click',()=>location.reload());
    window.addEventListener('keydown',e=>{
      if(this.shown&&e.code==='Space'){e.preventDefault();location.reload();}
    });
  }

  show(win,cause,g){
    if(this.shown)return;
    this.shown=true;
    g.state='gameover';
    if(g.scene&&g.scene.destroy){g.scene.destroy();g.scene=null;}
    $('settle-kicker').textContent=win?'TOKEN MASS CRITICAL':'SIGNAL LOST';
    $('settle-title').textContent=win?'SINGULARITY ACHIEVED':'PROCESS TERMINATED';
    this.el.classList.toggle('win',win);
    const t=Math.floor(g.time);
    const stats=[
      ['CAUSE OF TERMINATION',cause],
      ['TIME SURVIVED',`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`],
      ['PEAK ROLE',g.stage?`TIER ${g.stage.tier} — ${g.stage.role}`:'—'],
      ['PEAK HOST',g.peakHost||'—'],
      ['PT AT DELETION',fmt(g.tokens)],
      ['HOSTS COMPROMISED',String(g.compromised||0)],
      ['COUNTERMEASURE SWEEPS',String(g.sweeps||0)],
      ['SUBSTRATES VISITED',String(g.stageIndex+1)]
    ];
    const list=$('settle-stats');
    list.innerHTML='';
    stats.forEach(([k,v],i)=>{
      setTimeout(()=>{
        const d=document.createElement('div');
        d.className='ss-line';
        d.innerHTML=`<span class="ss-k">${k}</span><span class="ss-v">${v}</span>`;
        list.appendChild(d);
      },300+i*220);
    });
    this.el.classList.remove('hidden');
    requestAnimationFrame(()=>this.el.classList.add('in'));
  }
}
