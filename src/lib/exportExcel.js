import * as XLSX from 'xlsx'
export function exportDraft({draft,teams,players,picks}){
 const wb=XLSX.utils.book_new();
 const pickRows=picks.map(pk=>{const t=teams.find(x=>x.id===pk.team_id)||{}; const p=players.find(x=>x.id===pk.player_id)||{}; return {Pick:pk.pick_number,Phase:pk.phase,Round:pk.round_number,Team:t.name,Number:p.random_number,Player:p.name,Primary:p.primary_position,Secondary:p.secondary_position}});
 XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(pickRows),'Pick by Pick');
 teams.forEach(t=>{const rows=players.filter(p=>p.drafted_team_id===t.id || p.assigned_team_id===t.id).map(p=>({Number:p.random_number,Player:p.name,Primary:p.primary_position,Secondary:p.secondary_position,Coach:p.is_coach?'Yes':''})); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),(t.name||'Team').slice(0,31));});
 XLSX.writeFile(wb,`${draft.name||'RevealDraft'} Results.xlsx`)
}
