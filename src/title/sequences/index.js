// Built-in sequences. Add ONE line here to ship a replacement module,
// or register it externally (no edit needed) via:
//   window.PotentialThreatIntro.register('my-3d', ctx => createMy3D(ctx))
// then open  index.html?intro=my-3d

import { registerIntro } from '../registry.js';
import { createWireRelaySequence } from './wire-relay.js';
import { createWireframeSequence } from './wireframe.js';
import { createTemplateSequence } from './template.js';

// default cutscene (see DEFAULT_INTRO_ID in registry.js)
registerIntro('wire-relay',()=>createWireRelaySequence());
// kept as a verified safety fallback + examples
registerIntro('wireframe',()=>createWireframeSequence());
registerIntro('template',()=>createTemplateSequence());
