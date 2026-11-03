// =====================================================================
// Title — thin compatibility adapter. Game core still does `new Title(cb)`;
// ALL visual/interaction logic now lives in the pluggable intro runtime.
//   src/title/runtime.js        host (loop, input, phases, fallback)
//   src/title/contract.js       the spec + ctx variables
//   src/title/registry.js       id -> factory, ?intro=<id>
//   src/title/sequences/*.js    replaceable cutscenes
// =====================================================================

import { TitleRuntime } from '../title/runtime.js';

export class Title{
  constructor(onStart,opts={}){
    this.runtime=new TitleRuntime({onStart,...opts});
  }
}

export { TitleRuntime };
