export function snakeTeamAt(teams, pickIndex){
  const ordered=[...teams].sort((a,b)=>(a.draft_order??999)-(b.draft_order??999));
  if(!ordered.length) return null;
  const round=Math.floor(pickIndex/ordered.length);
  const slot=pickIndex%ordered.length;
  return (round%2===0)?ordered[slot]:ordered[ordered.length-1-slot];
}
export function roundFor(teams,pickIndex){return Math.floor(pickIndex/Math.max(teams.length,1))+1}
export function shuffle(arr){return [...arr].map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(x=>x[1])}
export function visiblePlayer(p, drafted=false){return drafted? p.name : `#${p.random_number}`}
