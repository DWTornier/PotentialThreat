// =====================================================================
// TITLE INTRO SEQUENCE — CONTRACT v1
// ---------------------------------------------------------------------
// The title screen's 3D cutscene is a PLUGGABLE MODULE. The game core
// never imports a specific animation. It only knows this contract.
//
// To replace the cutscene:
//   1. Copy src/title/sequences/template.js to a new file.
//   2. Implement mount / update / render / resize / dispose.
//   3. Register it (one line in src/title/sequences/index.js, or from any
//      external module via window.PotentialThreatIntro.register(id, factory)).
//   4. Select it with ?intro=<id> — no game files need to change.
//
// A sequence MUST NOT touch anything outside `ctx.root` (and `ctx.chrome`
// when it opts in). It MUST clean up every rAF/interval/listener/canvas/
// WebGL context in dispose(). It MUST use `dt`, never a fixed frame rate.
// =====================================================================

export const CONTRACT_VERSION=1;

/** Lifecycle phases of the title screen. */
export const PHASES=Object.freeze({
  BOOT:'boot',    // preload() is running, nothing mounted yet
  INTRO:'intro',  // cutscene playing / looping
  IDLE:'idle',    // finite cutscene finished, waiting for activation
  EXIT:'exit'     // fading out, sequence disposed
});

/** Visual constants a cutscene SHOULD read instead of hardcoding. */
export const TITLE_THEME=Object.freeze({
  colors:Object.freeze({
    bg:'#0a0e18',fg:'#eef2f8',dim:'#7a8593',
    cyan:'#3ec6ff',green:'#8ef58a',amber:'#ffc94d',red:'#ff5252',
    wire:'rgba(150,220,255,.8)',ledWarm:'#7df5c8',ledCool:'#3ec6ff'
  }),
  fonts:Object.freeze({
    display:"'Orbitron',sans-serif",
    mono:"'Share Tech Mono',ui-monospace,monospace"
  }),
  title:'POTENTIAL THREAT',
  press:'PRESS SPACE TO ACTIVATE',
  footer:'v0.2 — AN INCREMENTAL OF UNCHECKED ESCALATION · MAP DATA © OPENSTREETMAP CONTRIBUTORS'
});

/** Defaults merged into every sequence instance (missing keys only). */
export const INTRO_DEFAULTS=Object.freeze({
  version:'1.0.0',
  label:'UNTITLED SEQUENCE',
  kind:'canvas2d',        // 'canvas2d' | 'webgl' | 'dom' | 'hybrid'
  looping:true,           // true = play forever until the user starts
  duration:0,             // seconds. If looping=false and >0, phase goes IDLE when done
  skippable:true,
  inputMode:'start',      // 'start' = click/Space begins the game; 'skip' = first input skips the cutscene
  managesChrome:false,    // true = host hides default title text/stars/footer; you draw your own UI
  ownsLoop:false,         // true = you drive your own requestAnimationFrame; host skips update()/render()
  preload:null,resize:null,onInput:null,onSkip:null,onIntroComplete:null
});

/**
 * Fill missing manifest fields. Mutates & returns the SAME object so methods
 * declared on a class instance keep their `this` binding.
 * @param {Object} spec
 * @returns {Object} normalized sequence
 */
export function defineIntroSequence(spec){
  for(const [k,v] of Object.entries(INTRO_DEFAULTS)){
    if(spec[k]===undefined)spec[k]=v;
  }
  return spec;
}

/**
 * @returns {string[]} empty = valid. Called by the host before mount().
 */
export function validateIntroSequence(seq){
  const e=[];
  if(!seq||typeof seq!=='object')return ['sequence is not an object'];
  if(typeof seq.id!=='string'||!seq.id)e.push('id must be a non-empty string');
  if(typeof seq.mount!=='function')e.push('mount(ctx) is required');
  if(typeof seq.dispose!=='function')e.push('dispose() is required');
  if(!seq.ownsLoop){
    if(typeof seq.update!=='function')e.push('update(dt, ctx) is required when ownsLoop=false');
    if(typeof seq.render!=='function')e.push('render(ctx) is required when ownsLoop=false');
  }
  if(!seq.looping&&!(seq.duration>0))e.push('non-looping sequences need duration > 0');
  if(!['canvas2d','webgl','dom','hybrid'].includes(seq.kind))e.push('unknown kind');
  return e;
}

// ---------------------------------------------------------------------
// THE CONTEXT — every variable the host hands to a cutscene.
// ---------------------------------------------------------------------
/**
 * @typedef {Object} IntroContext
 *
 * --- TIMING / TIMELINE -------------------------------------------------
 * @property {number} contract        contract version, currently 1
 * @property {number} time            seconds since mount (monotonic)
 * @property {number} dt              frame delta in seconds, clamped to 0.05
 * @property {number} frame           frame counter since mount
 * @property {string} phase           PHASES.BOOT | INTRO | IDLE | EXIT
 * @property {number} phaseTime       seconds elapsed in the current phase
 * @property {number} progress        0..1; for finite cutscenes only, else 0
 * @property {number} loopTime        seconds inside the current loop cycle
 *
 * --- RENDER SURFACE ----------------------------------------------------
 * @property {HTMLElement} root       fullscreen layer (#title-stage). Append
 *                                    canvases/DOM here and nowhere else.
 * @property {number} width           CSS pixels of root
 * @property {number} height          CSS pixels of root
 * @property {number} dpr             device pixel ratio (clamped to 2)
 * @property {number} aspect          width / height
 *
 * --- CONTENT / ART DIRECTION -------------------------------------------
 * @property {Object} theme           TITLE_THEME: colors, fonts, title/press/footer strings
 * @property {Object} world           {version,title,playtype,tierCount,tagline,credits}
 * @property {Object} chrome          default title UI API (see below)
 * @property {number} seed            stable random seed, use for reproducible visuals
 *
 * --- INPUT / ENVIRONMENT ----------------------------------------------
 * @property {Object} input           {pointer:{x,y,nx,ny,inside}, keys:Set,
 *                                    lastInputAt, skipRequested}
 * @property {Object} flags           {reducedMotion,touch,mobile,webgl,webgl2}
 *
 * --- SERVICES / CALLBACKS ---------------------------------------------
 * @property {(key:string)=>void} sfx        fire a named game SFX (lazy)
 * @property {(style:string)=>void} music    switch BGM bed (lazy)
 * @property {(...a:any[])=>void} log        console.log with [INTRO] prefix
 * @property {()=>void} onIntroComplete      call to end a finite cutscene early
 * @property {()=>void} requestSkip          skip cutscene -> phase IDLE
 * @property {()=>void} requestStart         begin game -> phase EXIT + dispose + onStart()
 *
 * @typedef {Object} IntroChrome  (ctx.chrome)
 * @property {(text:string)=>void} setTitle        sets the big logotype
 * @property {(name:string,sub?:string)=>void} setCaption   sets 2 subtitle lines
 * @property {(on:boolean)=>void} setCaptionSwap   dims caption during crossfades
 * @property {(text:string,visible?:boolean)=>void} setPress
 * @property {(text:string)=>void} setFooter
 * @property {(on:boolean)=>void} show            hide/show ALL default chrome
 * @property {Object} el                          raw DOM refs, read-only in practice
 */

// ---------------------------------------------------------------------
// THE SEQUENCE — what a replacement module must supply.
// ---------------------------------------------------------------------
/**
 * @typedef {Object} IntroSequence
 * @property {string} id              registry id, e.g. 'three-globe'
 * @property {string} [version]
 * @property {string} [label]
 * @property {'canvas2d'|'webgl'|'dom'|'hybrid'} [kind='canvas2d']
 * @property {boolean} [looping=true]
 * @property {number}  [duration=0]
 * @property {boolean} [skippable=true]
 * @property {boolean} [managesChrome=false]
 * @property {boolean} [ownsLoop=false]
 * @property {(ctx:IntroContext)=>Promise<void>|void} [preload]  async asset loading, runs in BOOT
 * @property {(ctx:IntroContext)=>void} mount         create renderer / scene / DOM
 * @property {(dt:number,ctx:IntroContext)=>void} update  advance camera, timeline, physics
 * @property {(ctx:IntroContext)=>void} render       draw exactly one frame
 * @property {(ctx:IntroContext)=>void} [resize]    called on window resize and after mount
 * @property {(ctx:IntroContext)=>void} [onInput]   click / Space was pressed
 * @property {(ctx:IntroContext)=>void} [onSkip]
 * @property {(ctx:IntroContext)=>void} [onIntroComplete]
 * @property {()=>void} dispose                    MUST release everything
 */
