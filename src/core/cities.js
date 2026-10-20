// =====================================================================
// CITIES — famous metropoli used as random substrates for the
// street-level (tier 2) and metro (tier 3) stages. Every run picks a
// different city, so the OSM tiles and district names stay fresh.
// Fields: name, tag (short log label), ip style prefix per city,
// district = tier-2 center [lat,lng], metro = tier-3 center.
// =====================================================================

export const CITIES=[
  {name:'NEW_YORK',tag:'NYC',district:[40.7439,-73.9196],metro:[40.7128,-74.006]},
  {name:'TOKYO',tag:'TYO',district:[35.6710,139.7650],metro:[35.6895,139.6917]},
  {name:'LONDON',tag:'LDN',district:[51.5140,-0.1280],metro:[51.5074,-0.1278]},
  {name:'PARIS',tag:'PAR',district:[48.8660,2.3320],metro:[48.8566,2.3522]},
  {name:'SHANGHAI',tag:'SHA',district:[31.2360,121.4990],metro:[31.2304,121.4737]},
  {name:'HONG_KONG',tag:'HKG',district:[22.2960,114.1700],metro:[22.3193,114.1694]},
  {name:'SINGAPORE',tag:'SIN',district:[1.2920,103.8550],metro:[1.3521,103.8198]},
  {name:'SEOUL',tag:'SEL',district:[37.5665,126.9780],metro:[37.5665,126.9780]},
  {name:'BERLIN',tag:'BER',district:[52.5190,13.4040],metro:[52.5200,13.4050]},
  {name:'SAN_FRANCISCO',tag:'SFO',district:[37.7790,-122.4190],metro:[37.7749,-122.4194]},
  {name:'LOS_ANGELES',tag:'LAX',district:[34.0520,-118.2440],metro:[34.0522,-118.2437]},
  {name:'CHICAGO',tag:'CHI',district:[41.8820,-87.6290],metro:[41.8781,-87.6298]},
  {name:'DUBAI',tag:'DXB',district:[25.2040,55.2700],metro:[25.2048,55.2708]},
  {name:'MOSCOW',tag:'MOW',district:[55.7520,37.6170],metro:[55.7558,37.6173]},
  {name:'SYDNEY',tag:'SYD',district:[-33.8680,151.2090],metro:[-33.8688,151.2093]},
  {name:'SAO_PAULO',tag:'SAO',district:[-23.5550,-46.6390],metro:[-23.5505,-46.6333]},
  {name:'TORONTO',tag:'YYZ',district:[43.6530,-79.3830],metro:[43.6532,-79.3832]},
  {name:'MEXICO_CITY',tag:'MEX',district:[19.4330,-99.1330],metro:[19.4326,-99.1332]},
  {name:'MUMBAI',tag:'BOM',district:[19.0760,72.8770],metro:[19.0760,72.8777]},
  {name:'CAIRO',tag:'CAI',district:[30.0440,31.2360],metro:[30.0444,31.2357]},
  {name:'ISTANBUL',tag:'IST',district:[41.0080,28.9780],metro:[41.0082,28.9784]},
  {name:'BANGKOK',tag:'BKK',district:[13.7560,100.5020],metro:[13.7563,100.5018]},
  {name:'JAKARTA',tag:'CGK',district:[-6.2080,106.8460],metro:[-6.2088,106.8456]},
  {name:'BUENOS_AIRES',tag:'BUE',district:[-34.6040,-58.3820],metro:[-34.6037,-58.3816]},
  {name:'CAPE_TOWN',tag:'CPT',district:[-33.9250,18.4240],metro:[-33.9249,18.4241]},
  {name:'STOCKHOLM',tag:'STO',district:[59.3290,18.0690],metro:[59.3293,18.0686]}
];

// pick a city, avoiding an immediate repeat if possible
export function pickCity(excludeName){
  const pool=excludeName?CITIES.filter(c=>c.name!==excludeName):CITIES;
  const list=pool.length?pool:CITIES;
  return list[Math.floor(Math.random()*list.length)];
}
