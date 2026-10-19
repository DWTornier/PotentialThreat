// Minimal solid-glyph icon set (24x24, currentColor). Used on map pins.
const P={
  router:'<rect x="4" y="12" width="16" height="7" rx="1.5"/><path d="M8 12V6M13 12V3" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="7" cy="15.5" r="1" fill="rgba(10,13,18,.6)"/><circle cx="10" cy="15.5" r="1" fill="rgba(10,13,18,.6)"/>',
  desktop:'<rect x="3" y="4" width="18" height="12" rx="1"/><rect x="7" y="16.5" width="10" height="1.6"/><rect x="9" y="18" width="6" height="2.5"/>',
  mail:'<path d="M3 5h18v14H3z"/><path d="M3 5l9 7 9-7" fill="rgba(10,13,18,.55)"/>',
  printer:'<rect x="5" y="10" width="14" height="6" rx="1"/><rect x="8" y="4" width="8" height="5"/><rect x="8" y="14" width="8" height="6" fill="rgba(10,13,18,.4)" stroke="currentColor" stroke-width="1.2"/>',
  bulb:'<circle cx="12" cy="9" r="5.5"/><rect x="9.5" y="14" width="5" height="5" rx="1"/>',
  camera:'<path d="M3 8l13-3.5L17.5 9 4.5 12.5z"/><rect x="15.5" y="9" width="5.5" height="3" rx="1"/><path d="M6 12.5L5 18h3l1-4.8z"/>',
  server:'<rect x="3" y="3" width="18" height="5" rx="1"/><rect x="3" y="10" width="18" height="5" rx="1"/><rect x="3" y="17" width="18" height="4.5" rx="1"/><circle cx="6.5" cy="5.5" r="1" fill="rgba(10,13,18,.6)"/><circle cx="6.5" cy="12.5" r="1" fill="rgba(10,13,18,.6)"/><circle cx="6.5" cy="19.2" r="1" fill="rgba(10,13,18,.6)"/>',
  van:'<path d="M2 7.5h12V15H2z"/><path d="M14 9.5h4.5L21.5 13v2H14z"/><circle cx="7" cy="16.5" r="2.2"/><circle cx="17" cy="16.5" r="2.2"/>',
  billboard:'<rect x="3" y="3.5" width="18" height="9" rx="0.5"/><rect x="10.8" y="12.5" width="2.4" height="8"/>',
  atm:'<rect x="6" y="3" width="12" height="18" rx="1"/><rect x="8.5" y="5.5" width="7" height="4" fill="rgba(10,13,18,.5)"/><rect x="8.5" y="12" width="7" height="1.6" fill="rgba(10,13,18,.5)"/>',
  bolt:'<path d="M13.5 2L5 13.5h5L8 22l10-12.5h-5.5z"/>',
  traffic:'<rect x="8" y="2" width="8" height="14" rx="2"/><rect x="11" y="16" width="2" height="6"/><circle cx="12" cy="6" r="1.6" fill="rgba(10,13,18,.5)"/><circle cx="12" cy="9.5" r="1.6" fill="rgba(10,13,18,.5)"/><circle cx="12" cy="13" r="1.6" fill="rgba(10,13,18,.5)"/>',
  police:'<path d="M12 2l8.5 3.2V11c0 5.2-3.6 9.3-8.5 11-4.9-1.7-8.5-5.8-8.5-11V5.2z"/><path d="M12 6l1.7 3.4 3.8.5-2.8 2.7.7 3.8L12 14.6 8.6 16.4l.7-3.8L6.5 9.9l3.8-.5z" fill="rgba(10,13,18,.45)"/>',
  drone:'<circle cx="5" cy="5" r="3"/><circle cx="19" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
  megaphone:'<path d="M14 4L5 8H2v7h3l9 4z"/><path d="M17 8a5 5 0 0 1 0 8" stroke="currentColor" stroke-width="2" fill="none"/><path d="M19.5 5.5a9 9 0 0 1 0 13" stroke="currentColor" stroke-width="2" fill="none"/>',
  bank:'<path d="M12 2L22 8H2z"/><rect x="4" y="10" width="3" height="8"/><rect x="10.5" y="10" width="3" height="8"/><rect x="17" y="10" width="3" height="8"/><rect x="2" y="19.5" width="20" height="2.5"/>',
  chart:'<rect x="3" y="13" width="4" height="8"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="10" width="4" height="11"/>',
  dish:'<path d="M4 4a13 13 0 0 0 16 16z"/><path d="M13 11l7-7" stroke="currentColor" stroke-width="2.2" fill="none"/><circle cx="20" cy="4" r="1.6"/>',
  satellite:'<g transform="rotate(45 12 12)"><rect x="9" y="8.5" width="6" height="7" rx="0.5"/><rect x="0.5" y="10" width="7" height="4"/><rect x="16.5" y="10" width="7" height="4"/></g>',
  wave:'<path d="M2 10c3-3.5 5 3.5 8 0s5 3.5 8 0 3.5-1.5 4-.8" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="M2 15.5c3-3.5 5 3.5 8 0s5 3.5 8 0 3.5-1.5 4-.8" stroke="currentColor" stroke-width="2.2" fill="none"/>',
  city:'<rect x="3" y="9" width="5" height="12"/><rect x="9.5" y="4" width="5.5" height="17"/><rect x="16.5" y="11" width="4.5" height="10"/><rect x="11" y="6" width="1.2" height="1.2" fill="rgba(10,13,18,.6)"/>',
  flask:'<path d="M9.5 3h5v5.2l5 10A2 2 0 0 1 17.7 21H6.3a2 2 0 0 1-1.8-2.8l5-10z"/>',
  mars:'<circle cx="9.5" cy="14.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M13.5 10.5L20 4M20 9V4h-5" stroke="currentColor" stroke-width="2.4" fill="none"/>',
  asteroid:'<path d="M7 3.5l8.5-1L21 8l-1.5 8.5L11 20l-7-5.5z"/><circle cx="10" cy="10" r="1.5" fill="rgba(10,13,18,.5)"/><circle cx="15" cy="14" r="1" fill="rgba(10,13,18,.5)"/>',
  sun:'<circle cx="12" cy="12" r="4.2"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4M4.6 4.6l2.8 2.8M16.6 16.6l2.8 2.8M19.4 4.6l-2.8 2.8M7.4 16.6l-2.8 2.8" stroke="currentColor" stroke-width="2.2"/>',
  gate:'<ellipse cx="12" cy="12" rx="9.5" ry="5" fill="none" stroke="currentColor" stroke-width="2.6"/><ellipse cx="12" cy="12" rx="3.5" ry="1.8"/>'
};

export function iconSvg(name){
  return `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${P[name]||P.server}</svg>`;
}
