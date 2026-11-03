// =====================================================================
// INTRO REGISTRY — pick a cutscene without touching the game core.
//
// Selection priority:
//   1. URL query  ?intro=<id>
//   2. window.PotentialThreatIntroConfig.id  (set by an inline script)
//   3. localStorage 'pt.intro'
//   4. DEFAULT_INTRO_ID
//
// Unknown ids and throwing implementations fall back to FALLBACK_INTRO_ID.
// =====================================================================

import { CONTRACT_VERSION } from './contract.js';

const FACTORIES=new Map();

export const DEFAULT_INTRO_ID='wire-relay';
export const FALLBACK_INTRO_ID='wireframe'; // verified minimal fallback if the default throws

/** @param {string} id @param {(ctx:any)=>object} factory */
export function registerIntro(id,factory,{overwrite=false}={}){
  if(typeof id!=='string'||!id||typeof factory!=='function')return false;
  if(FACTORIES.has(id)&&!overwrite)return false;
  FACTORIES.set(id,factory);
  return true;
}

export function unregisterIntro(id){return FACTORIES.delete(id);}
export function listIntroIds(){return [...FACTORIES.keys()];}
export function resolveIntroFactory(id){return FACTORIES.get(id)||null;}

function requestedId(){
  try{
    const q=new URLSearchParams(location.search).get('intro');
    if(q)return q;
    if(window.PotentialThreatIntroConfig&&window.PotentialThreatIntroConfig.id)
      return String(window.PotentialThreatIntroConfig.id);
    const saved=localStorage.getItem('pt.intro');
    if(saved)return saved;
  }catch(e){/* file:// or privacy mode */}
  return DEFAULT_INTRO_ID;
}

export function selectIntroId(){
  const id=requestedId();
  return FACTORIES.has(id)?id:FALLBACK_INTRO_ID;
}

/**
 * Public, dependency-free injection point. An external module loaded BEFORE
 * src/main.js can register its own sequence without editing any game file:
 *
 *   import { registerIntro } from './src/title/registry.js';
 *   registerIntro('my-3d', ctx => createMySequence(ctx));
 *
 * Or from a plain script: window.PotentialThreatIntro.register('my-3d', f)
 */
const API={
  contract:CONTRACT_VERSION,
  register:registerIntro,
  unregister:unregisterIntro,
  list:listIntroIds,
  current:selectIntroId,
  /** Persist a choice for the next reload. */
  use(id){
    try{localStorage.setItem('pt.intro',String(id));}catch(e){/* ignore */}
    return id;
  },
  /** Remove a persisted choice. */
  reset(){
    try{localStorage.removeItem('pt.intro');}catch(e){/* ignore */}
  }
};

if(typeof window!=='undefined')window.PotentialThreatIntro=API;
