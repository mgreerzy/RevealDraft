import React,{useEffect,useMemo,useState}from'react';
import{createRoot}from'react-dom/client';
import{Clock,Download,Pause,Play,Shuffle,Upload,Volume2}from'lucide-react';
import Papa from'papaparse';
import{motion,AnimatePresence}from'framer-motion';
import'./styles/app.css';
import{supabase}from'./lib/supabase';
import{snakeTeamAt,roundFor,shuffle}from'./lib/draftLogic';
import{exportDraft}from'./lib/exportExcel';
import AdminDashboard from './components/AdminDashboard';
import { playSound } from "./lib/sounds";

const logo='/revealdraft-logo.jpeg';

function App(){
  const[session,setSession]=useState(null);
  const[profile,setProfile]=useState(null);
  const[drafts,setDrafts]=useState([]);
  const[draftId,setDraftId]=useState(localStorage.draftId||'');

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    return supabase.auth.onAuthStateChange((_,s)=>setSession(s)).data.subscription.unsubscribe;
  },[]);

  useEffect(()=>{
    if(session){
      supabase
        .from('profiles')
        .select('*')
        .eq('id',session.user.id)
        .single()
        .then(({data})=>setProfile(data));
    }
  },[session]);

  if(location.pathname.startsWith('/tv'))return <TV/>;
  if(location.pathname.startsWith('/viewer'))return <Viewer/>;
  if(!session)return <Login/>;

  return <Shell profile={profile} drafts={drafts} setDrafts={setDrafts} draftId={draftId} setDraftId={setDraftId}/>;
}

function Login(){
  const[email,setEmail]=useState('');
  const[password,setPassword]=useState('');
  const[err,setErr]=useState('');

  async function login(){
    setErr('');
    const{error}=await supabase.auth.signInWithPassword({email,password});
    if(error)setErr(error.message);
  }

  return (
    <div className="login">
      <img src={logo}/>
      <h1>RevealDraft</h1>
      <p>The live draft experience for rec sports.</p>
      <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
      <input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)}/>
      <button onClick={login}>Sign In</button>
      {err&&<b className="bad">{err}</b>}
    </div>
  );
}

function Shell({profile,draftId,setDraftId}){
  const [viewMode, setViewMode] = useState("draft");
  const[drafts,setDrafts]=useState([]);
  const[data,setData]=useState({draft:null,teams:[],players:[],picks:[],queues:[]});
  

useEffect(() => {
  loadAvailableDrafts();
}, [profile?.id]);

async function loadAvailableDrafts() {
  if (profile?.role === "admin") {
    const { data, error } = await supabase
      .from("drafts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return alert(error.message);

    setDrafts(data || []);

    if (!draftId && data?.[0]) {
      setDraftId(data[0].id);
      localStorage.draftId = data[0].id;
    }

    return;
  }

  if (profile?.role === "commissioner") {
    const { data: accessRows, error: accessError } = await supabase
      .from("draft_commissioners")
      .select("draft_id")
      .eq("user_id", profile.id);

    if (accessError) return alert(accessError.message);

    const draftIds = (accessRows || []).map((x) => x.draft_id);

    if (draftIds.length === 0) {
      setDrafts([]);
      setDraftId("");
      localStorage.removeItem("draftId");
      return;
    }

    const { data, error } = await supabase
      .from("drafts")
      .select("*")
      .in("id", draftIds)
      .order("created_at", { ascending: false });

    if (error) return alert(error.message);

    setDrafts(data || []);

    if (!draftId && data?.[0]) {
      setDraftId(data[0].id);
      localStorage.draftId = data[0].id;
    }

    return;
  }

  const { data, error } = await supabase
    .from("drafts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return alert(error.message);

  setDrafts(data || []);

  if (!draftId && data?.[0]) {
    setDraftId(data[0].id);
    localStorage.draftId = data[0].id;
  }
}

  useEffect(()=>{
    if(!draftId)return;
    load();
    const ch=supabase
      .channel('draft-'+draftId)
      .on('postgres_changes',{event:'*',schema:'public'},load)
      .subscribe();

    return()=>supabase.removeChannel(ch);
  },[draftId]);

  async function load(){
	const[d,t,p,pk,q,c]=await Promise.all([
	  supabase.from('drafts').select('*').eq('id',draftId).single(),
	  supabase.from('teams').select('*').eq('draft_id',draftId),
	  supabase.from('players').select('*').eq('draft_id',draftId),
	  supabase.from('picks').select('*').eq('draft_id',draftId).order('pick_number'),
	  supabase.from('queues').select('*').eq('draft_id',draftId).order('rank'),
	  supabase.from('draft_position_constraints').select('*').eq('draft_id',draftId)
	]);

    setData({
      draft:d.data,
      teams:t.data||[],
      players:p.data||[],
      picks:pk.data||[],
      queues:q.data||[],
      constraints:c.data||[],
    });
  }

  if(!profile)return <div className="loading">Loading…</div>;

  const isAdmin=profile.role==='admin';
  const isComm=profile.role==='commissioner'||isAdmin;

if (
  ["commissioner", "coach"].includes(profile?.role) &&
  drafts.length === 0
) {
  return (
    <div className="loading">
      <h1>No Draft Access</h1>

      <p>
        You have not been assigned to any drafts yet.
        Please contact your administrator.
      </p>

      <button
        onClick={() => supabase.auth.signOut()}
      >
        Sign Out
      </button>
    </div>
  );
}

  if (isAdmin && viewMode === "admin") {
    return (
      <AdminDashboard
        profile={profile}
        onSwitchToDraft={async () => {
	  setViewMode("draft");
	  await loadAvailableDrafts();
	}}
      />
    );
  }

  return (
    <>
      <header>
        <div className="brand">
          <img src={logo}/>
          <span>RevealDraft</span>
        </div>

	<select
	  value={draftId || ""}
	  onChange={(e) => {
	    setDraftId(e.target.value);
	    localStorage.draftId = e.target.value;
	  }}
	>
	  {drafts.map((d) => (
	    <option key={d.id} value={d.id}>
	      {d.name}
	    </option>
	  ))}
	</select>

	<button onClick={loadAvailableDrafts}>
	  Refresh Drafts
	</button>

        <span className="pill">{profile.role}</span>
        <button onClick={()=>supabase.auth.signOut()}>Sign Out</button>

{isComm && (
  <button onClick={() => setViewMode("admin")}>
    Admin Dashboard
  </button>
)}
      </header>

      <main>
        {data.draft&&<DraftRoom data={data} profile={profile} isComm={isComm} reload={load}/>}
      </main>
    </>
  );
}

function Admin({drafts,reload}){
  const[name,setName]=useState('');

  async function create(){
    if(!name)return;
    await supabase.from('drafts').insert({name,type:'coed'});
    reload();
  }

  return (
    <section className="panel admin">
      <h2>Admin</h2>
      <input placeholder="New draft name" value={name} onChange={e=>setName(e.target.value)}/>
      <button onClick={create}>Create Draft</button>
      <p className="muted">Create users in Supabase Authentication, then set their role in the profiles table.</p>
    </section>
  );
}

function DraftRoom({data,profile,isComm,reload}){
  const{draft,teams,players,picks,queues,constraints=[]}=data;
console.log("DRAFT DATA:", draft);
  const myTeam=teams.find(t=>t.coach_user_id===profile.id);
  const currentTeam=snakeTeamAt(teams,draft.current_pick_index);
  const [overrideConstraints, setOverrideConstraints] = useState(false);
  const currentRoster = currentTeam
    ? players.filter(
        (p) =>
          p.drafted_team_id === currentTeam.id ||
          p.assigned_team_id === currentTeam.id
      )
    : [];

  const currentSalaryUsed = currentRoster.reduce(
    (sum, p) => sum + Number(p.salary_value || 0),
    0
  );

  const currentSalaryRemaining =
    Number(draft.salary_cap_amount || 0) - currentSalaryUsed;
  const currentRound = roundFor(teams, draft.current_pick_index);
  const currentPhase=draft.type==='coed'?draft.current_phase:'any';
  const available=players.filter(
  p =>
    !p.drafted_team_id &&
    !p.assigned_team_id &&
    !p.is_coach &&
    (currentPhase==='any'||p.gender===currentPhase||p.gender==='any')
);
  const canPick=(isComm||currentTeam?.id===myTeam?.id)&&draft.status==='live';
  const[tab,setTab]=useState('available');
  const[flash,setFlash]=useState(null);

function wouldExceedPositionMax(player, team) {
  if (!constraints.length) return false;

  const roster = players.filter(
    (p) => p.drafted_team_id === team.id || p.assigned_team_id === team.id
  );

  const activeMaxConstraints = constraints.filter(
    (c) => c.max_count !== null && c.max_count !== undefined && c.max_count !== ""
  );

  if (!activeMaxConstraints.length) return false;

  const hasAnyPositionAvailable = activeMaxConstraints.some((c) => {
    const pos = c.position?.toUpperCase();

    const currentCount = roster.filter((p) => {
      return (
        p.primary_position?.toUpperCase() === pos ||
        p.secondary_position?.toUpperCase() === pos
      );
    }).length;

    return currentCount < Number(c.max_count);
  });

  if (!hasAnyPositionAvailable) {
    return false;
  }

  if (wouldExceedSalaryCap(player, team)) {
    return;
  }

  const positionsToCheck = [
    player.primary_position,
    player.secondary_position,
  ]
    .filter(Boolean)
    .map((x) => x.toUpperCase());

  for (const pos of positionsToCheck) {
    const constraint = activeMaxConstraints.find(
      (c) => c.position?.toUpperCase() === pos
    );

    if (!constraint) continue;

    const currentCount = roster.filter((p) => {
      return (
        p.primary_position?.toUpperCase() === pos ||
        p.secondary_position?.toUpperCase() === pos
      );
    }).length;

    if (currentCount + 1 > Number(constraint.max_count)) {
      alert(
        `Cannot draft this player yet. ${team.name} has reached the max of ${constraint.max_count} for ${pos}.`
      );
      return true;
    }
  }

  return false;
}

function wouldExceedSalaryCap(player, team) {
  if (!draft.salary_cap_enabled) return false;

  const cap = Number(draft.salary_cap_amount || 0);
  const playerSalary = Number(player.salary_value || 0);

  const roster = players.filter(
    (p) => p.drafted_team_id === team.id || p.assigned_team_id === team.id
  );

  const currentTotal = roster.reduce(
    (sum, p) => sum + Number(p.salary_value || 0),
    0
  );

  const newTotal = currentTotal + playerSalary;

  if (newTotal > cap) {
    alert(
      `${team.name} cannot draft ${player.name}. This would exceed the salary cap.\n\nCurrent: ${currentTotal}\nPlayer: ${playerSalary}\nCap: ${cap}`
    );
    return true;
  }

  return false;
}

function violatesPositionMinimum(player, team) {
  if (!constraints.length) return false;

  const roster = players.filter(
    (p) => p.drafted_team_id === team.id || p.assigned_team_id === team.id
  );

  const activeMinConstraints = constraints.filter(
    (c) => c.min_count !== null && c.min_count !== undefined && c.min_count !== ""
  );

  if (!activeMinConstraints.length) return false;

  const neededPositions = activeMinConstraints
    .filter((c) => {
      const pos = c.position?.toUpperCase();

      const currentCount = roster.filter((p) => {
        return (
          p.primary_position?.toUpperCase() === pos ||
          p.secondary_position?.toUpperCase() === pos
        );
      }).length;

      return currentCount < Number(c.min_count);
    })
    .map((c) => c.position?.toUpperCase());

  if (neededPositions.length === 0) return false;

  const playerPositions = [player.primary_position, player.secondary_position]
    .filter(Boolean)
    .map((x) => x.toUpperCase());

  const fillsNeededPosition = playerPositions.some((pos) =>
    neededPositions.includes(pos)
  );

  if (!fillsNeededPosition) {
    alert(
      `${team.name} must first draft a player who can fill: ${neededPositions.join(", ")}.`
    );
    return true;
  }

  return false;
}

  useEffect(()=>{
    if(draft.reveal_pick_id){
      setFlash('pick');
      playSound("pick");
      setTimeout(() => {
        setFlash('reveal');
        playSound("reveal");
      }, 5000);
      setTimeout(()=>setFlash(null),20000);
    }
  },[draft.reveal_pick_id]);

useEffect(() => {
  if (!isComm) return;
  if (draft.status !== "live") return;
  if (!currentTeam) return;

  const autoPlayer = players.find((p) => {
    const phaseMatch =
      currentPhase === "any" ||
      p.keeper_phase === "any" ||
      p.keeper_phase === currentPhase ||
      p.gender === currentPhase;

    return (
      p.assigned_team_id === currentTeam.id &&
      Number(p.keeper_round) === Number(currentRound) &&
      !p.drafted_team_id &&
      phaseMatch
    );
  });

  if (autoPlayer) {
    const timer = setTimeout(() => {
  	makePick(autoPlayer, currentTeam);
    }, 15000);

return () => clearTimeout(timer);
  }
}, [
  draft.current_pick_index,
  draft.status,
  currentTeam?.id,
  currentRound,
  currentPhase,
  players.length,
]);

async function logAudit(action, details = {}) {
  await supabase.from("audit_logs").insert({
    draft_id: draft.id,
    user_id: profile.id,
    action,
    details,
  });
}

async function makePick(player, team = currentTeam) {
  if (!team || !player) {
    return alert("Missing team or player.");
  }

  if (!overrideConstraints || !isComm) {
    if (violatesPositionMinimum(player, team)) return;
    if (wouldExceedPositionMax(player, team)) return;
    if (wouldExceedSalaryCap(player, team)) return;
  }

  const { error } = await supabase.rpc("make_draft_pick", {
    target_draft_id: draft.id,
    target_team_id: team.id,
    target_player_id: player.id,
    made_by_user_id: profile.id,
    pick_phase: currentPhase,
    round_num: roundFor(teams, draft.current_pick_index),
  });

  if (error) {
    console.error(error);
    return alert(error.message);
  }

  if (overrideConstraints) {
    setOverrideConstraints(false);
  }

  playSound("pick");

  await logAudit("pick_made", {
    team_id: team.id,
    team_name: team.name,
    player_id: player.id,
    player_name: player.name,
    random_number: player.random_number,
    phase: currentPhase,
    round: roundFor(teams, draft.current_pick_index),
    override_used: !!overrideConstraints && !!isComm,
  });

await reload();
}

  function nextDraftState(){
    let idx=draft.current_pick_index+1;
    let phase=draft.current_phase;
    const remaining=players.filter(p=>!p.drafted_team_id&&!p.is_coach&&p.id!==arguments[3]);
    const phaseLeft=remaining.some(p=>p.gender===phase||p.gender==='any');

    if(draft.type==='coed'&&!phaseLeft){
      const next=draft.phase_order.find(x=>x!==phase);
      phase=next||phase;
    }

    return{
      current_pick_index:idx,
      current_phase:phase,
      reveal_pick_id:arguments[3],
      reveal_until:new Date(Date.now()+10000).toISOString(),
      pick_started_at:new Date().toISOString(),
      status:remaining.length?'live':'complete'
    };
  }

	async function undoLastPick() {
	  if (!draft?.id) return alert("No draft selected.");

	  const confirmUndo = window.confirm("Undo the last draft pick?");
	  if (!confirmUndo) return;

	  const { error } = await supabase.rpc("undo_last_pick", {
	    target_draft_id: draft.id,
	  });

	  if (error) {
	    console.error(error);
	    return alert(error.message);
	  }

	  await logAudit("undo_last_pick", {
	    draft_id: draft.id,
	  });

	  await reload();
	}

  async function pause(status){
    await supabase
      .from('drafts')
      .update({status,pick_started_at:new Date().toISOString()})
      .eq('id',draft.id);
  }

  async function randomize(){
    const shuffled=shuffle(teams);

    for(let i=0;i<shuffled.length;i++){
      await supabase.from('teams').update({draft_order:i+1}).eq('id',shuffled[i].id);
    }

    let nums=shuffle(players.map((_,i)=>i+1));

    for(let i=0;i<players.length;i++){
      await supabase.from('players').update({random_number:nums[i]}).eq('id',players[i].id);
    }

    reload();
  }

  async function addQueue(p){
    if(!myTeam)return;
    await supabase
      .from('queues')
      .insert({
        draft_id:draft.id,
        team_id:myTeam.id,
        player_id:p.id,
        rank:(queues.filter(q=>q.team_id===myTeam.id).length+1)
      });
  }

  return (
    <section className="draft">
      <AnimatePresence>
        {flash&&<RevealOverlay
  	  mode={flash}
  	  pick={picks.find(p=>p.id===draft.reveal_pick_id)}
  	  players={players}
 	  teams={teams}
  	  currentTeam={currentTeam}
  	  nextTeam={snakeTeamAt(teams,draft.current_pick_index+1)}
	  />}
      </AnimatePresence>

      <div className="scorebar">
        <h1>{draft.name}</h1>
        <div className="draft-status">
  	  <div className="clock-team">
  	      <span className="label">On the clock:</span>
  	      <span className="team-name">{currentTeam?.name || '-'}</span>
  	    </div>

  	    <Timer draft={draft}/>

  	    <div className="phase">
  	      PHASE: {currentPhase?.toUpperCase()}
  	    </div>

  	    {draft?.salary_cap_enabled && (
  	      <div className="salary-cap-display">
  	        Salary Cap Remaining: {currentSalaryRemaining}
  	      </div>
  	    )}
  	  </div>

        {isComm&&
          <div className="actions">
            <button onClick={()=>pause('live')}><Play size={16}/>Start</button>
            <button onClick={()=>pause('paused')}><Pause size={16}/>Pause</button>
	    <button onClick={undoLastPick}>Undo Last Pick</button>
            <button onClick={randomize}><Shuffle size={16}/>Randomize</button>
            <button onClick={()=>exportDraft(data)}><Download size={16}/>Export XLS</button>
	    <label className="override-toggle">
	      <input
	        type="checkbox"
	        checked={overrideConstraints}
	        onChange={(e) => setOverrideConstraints(e.target.checked)}
	      />
	      Override salary / position constraints
	    </label>
          </div>
        }
      </div>

      <nav className="tabs">
        {['available','picks','roster','positions','queue','teams','commissioner']
          .filter(x=>x!=='commissioner'||isComm)
          .map(x=><button key={x} className={tab===x?'active':''} onClick={()=>setTab(x)}>{x}</button>)}
      </nav>

      {tab==='available'&&(
	  <PlayerGrid
	    players={available}
	    makePick={makePick}
	    canPick={canPick}
	    addQueue={addQueue}
	    salaryCapEnabled={!!draft?.salary_cap_enabled}
	  />
      )}

      {tab==='picks'&&<PickList picks={picks} players={players} teams={teams}/>}
      {tab==='roster'&&<Roster team={myTeam} players={players}/>}
      {tab==='positions'&&<PositionCounts team={myTeam} players={players}/>}
      {tab==='queue'&&<Queue
  queues={queues}
  team={myTeam}
  players={players}
  makePick={makePick}
  canPick={canPick}
  reload={reload}
/>}
      {tab==='teams'&&(
        <AllRosters
          teams={teams}
          players={players}
          draft={draft}
        />
      )}
      {tab==='commissioner'&&<CommissionerTools draft={draft} teams={teams} players={players} makePick={makePick}/>}
    </section>
  );
}

function PositionCounts({ team, players }) {
  if (!team) return <p>No team assigned.</p>;

  const roster = players.filter(
    (p) => p.drafted_team_id === team.id || p.assigned_team_id === team.id
  );

  const counts = {};

  roster.forEach((p) => {
    const primary = p.primary_position || "Unknown";
    const secondary = p.secondary_position || "";

    counts[primary] = (counts[primary] || 0) + 1;

    if (secondary && secondary !== primary) {
      counts[secondary] = (counts[secondary] || 0) + 1;
    }
  });

  const rows = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));

  if (rows.length === 0) {
    return <p>No players on roster yet.</p>;
  }

  return (
    <div className="panel">
      <h2>Position Counts</h2>

      <table>
        <tbody>
          <tr>
            <th>Position</th>
            <th>Players</th>
          </tr>

          {rows.map(([position, count]) => (
            <tr key={position}>
              <td>{position}</td>
              <td>{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Timer({draft}){
  const[now,setNow]=useState(Date.now());

  useEffect(()=>{
    const i=setInterval(()=>setNow(Date.now()),250);
    return()=>clearInterval(i);
  },[]);

  let left=draft.pick_seconds;

  if(draft.pick_started_at&&draft.status==='live'){
    left=Math.max(0,Math.ceil((new Date(draft.pick_started_at).getTime()+draft.pick_seconds*1000-now)/1000));
  }

  return <div className={'timer '+(left<15?'danger':'')}><Clock size={20}/>{left}</div>;
}

function PlayerGrid({players,makePick,canPick,addQueue,salaryCapEnabled}){
  return (

      <div className="grid">
        {players.sort((a,b)=>a.random_number-b.random_number).map(p=>(
          <div className="card" key={p.id}>
            <h2>#{p.random_number}</h2>
            <p>{p.primary_position} / {p.secondary_position}</p>
            <small>{p.gender}</small>

            {salaryCapEnabled && (
		<p className="salary-text">
		Salary: {p.salary_value ?? 0}
		</p>
	    )}

            <button disabled={!canPick} onClick={()=>makePick(p)}>
              Draft
            </button>

            <button onClick={()=>addQueue(p)}>
              Queue
            </button>
          </div>
        ))}
    </div>
  );
}

function PickList({picks,players,teams}){
  return (
    <table>
      <tbody>
        <tr><th>Pick</th><th>Team</th><th>Player</th><th>#</th><th>Pos</th></tr>
        {picks.map(pk=>{
          const p=players.find(x=>x.id===pk.player_id)||{};
          const t=teams.find(x=>x.id===pk.team_id)||{};
          return <tr key={pk.id}><td>{pk.pick_number}</td><td>{t.name}</td><td>{p.name}</td><td>{p.random_number}</td><td>{p.primary_position}/{p.secondary_position}</td></tr>;
        })}
      </tbody>
    </table>
  );
}

function Roster({team,players}){
  if(!team)return <p>No team assigned.</p>;

  return (
    <div>
      <h2>{team.name}</h2>
      <PlayerNames players={players.filter(p=>p.drafted_team_id===team.id||p.assigned_team_id===team.id)}/>
    </div>
  );
}

function AllRosters({teams,players,draft}){
  return (
    <div className="rosters">
      {teams.sort((a,b)=>a.draft_order-b.draft_order).map(t => {

  const roster = players.filter(
    (p) =>
      p.drafted_team_id === t.id ||
      p.assigned_team_id === t.id
  );

  const salaryUsed = roster.reduce(
    (sum, p) => sum + Number(p.salary_value || 0),
    0
  );

  const salaryRemaining =
    Number(draft?.salary_cap_amount || 0) - salaryUsed;

  return (
    <div className="panel" key={t.id}>
          <h2>{t.logo_url&&<img className="teamlogo" src={t.logo_url}/>} {t.name}</h2>

{draft?.salary_cap_enabled && (
  <div className="salary-row">
    <span>Used: {salaryUsed}</span>
    <span>Remaining: {salaryRemaining}</span>
  </div>
)}
          <PlayerNames players={players.filter(p=>p.drafted_team_id===t.id||p.assigned_team_id===t.id)}/>
        </div>
      );
      })}
    </div>
  );
}

function PlayerNames({players}){
  return <ul>{players.map(p=><li key={p.id}><b>#{p.random_number}</b> {p.name} — {p.primary_position}/{p.secondary_position}</li>)}</ul>;
}

function Queue({ queues, team, players, makePick, canPick, reload }) {
  async function removeFromQueue(queueId) {
    const { error } = await supabase.from("queues").delete().eq("id", queueId);
    if (error) return alert(error.message);
    if (reload) reload();
  }

  async function moveQueueItem(queueItem, direction) {
    const teamQueue = queues
      .filter((q) => q.team_id === team?.id)
      .sort((a, b) => a.rank - b.rank);

    const currentIndex = teamQueue.findIndex((q) => q.id === queueItem.id);
    const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (swapIndex < 0 || swapIndex >= teamQueue.length) return;

    const swapItem = teamQueue[swapIndex];

    const { error: firstError } = await supabase
      .from("queues")
      .update({ rank: swapItem.rank })
      .eq("id", queueItem.id);

    if (firstError) return alert(firstError.message);

    const { error: secondError } = await supabase
      .from("queues")
      .update({ rank: queueItem.rank })
      .eq("id", swapItem.id);

    if (secondError) return alert(secondError.message);

    if (reload) reload();
  }

  if (!team) return <p>No team assigned.</p>;

  const list = queues
    .filter((q) => q.team_id === team.id)
    .sort((a, b) => a.rank - b.rank)
    .map((q) => ({
      queueItem: q,
      player: players.find((p) => p.id === q.player_id),
    }))
    .filter((x) => x.player)
    .filter((x) => !x.player.drafted_team_id);

  if (list.length === 0) return <p>Your queue is empty.</p>;

  return (
    <div className="grid">
      {list.map(({ queueItem, player }, index) => (
        <div className="card" key={queueItem.id}>
          <h2>#{player.random_number}</h2>
          <p>{player.primary_position}/{player.secondary_position}</p>

          <button disabled={!canPick} onClick={() => makePick(player)}>
            Draft
          </button>

          <button disabled={index === 0} onClick={() => moveQueueItem(queueItem, "up")}>
            Move Up
          </button>

          <button disabled={index === list.length - 1} onClick={() => moveQueueItem(queueItem, "down")}>
            Move Down
          </button>

          <button onClick={() => removeFromQueue(queueItem.id)}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}

function CommissionerTools({draft,teams,players,makePick}){
  const[team,setTeam]=useState('');
  const[fileType,setFileType]=useState('players');

  async function importCsv(e){
    const file=e.target.files[0];

    Papa.parse(file,{
      header:true,
      complete:async r=>{
        if(fileType==='players'){
          await supabase
            .from('players')
            .insert(
              r.data
                .filter(x=>x.name)
                .map((x,i)=>({
                  draft_id:draft.id,
                  random_number:+x.random_number||i+1,
                  name:x.name,
                  gender:(x.gender||'any').toLowerCase(),
                  primary_position:x.primary_position,
                  secondary_position:x.secondary_position
                }))
            );
        }else{
          await supabase
            .from('teams')
            .insert(
              r.data
                .filter(x=>x.name)
                .map(x=>({
                  draft_id:draft.id,
                  name:x.name,
                  logo_url:x.logo_url,
                  draft_order:+x.draft_order||null
                }))
            );
        }

        location.reload();
      }
    });
  }

  return (
    <div className="panel">
      <h2>Commissioner Tools</h2>

      <select value={fileType} onChange={e=>setFileType(e.target.value)}>
        <option value="players">Player CSV</option>
        <option value="teams">Team CSV</option>
      </select>

      <label className="upload">
        <Upload/> Import CSV
        <input type="file" accept=".csv" onChange={importCsv}/>
      </label>

      <select value={team} onChange={e=>setTeam(e.target.value)}>
        <option value="">Pick for team…</option>
        {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
      </select>

      <PlayerGrid
	  players={available}
	  makePick={makePick}
	  canPick={canPick}
	  addQueue={addQueue}
	  salaryCapEnabled={!!draft?.salary_cap_enabled}
      />

    </div>
  );
}

function RevealOverlay({mode,pick,players,teams,currentTeam,nextTeam}){
  const p=players.find(x=>x.id===pick?.player_id)||{};
  const t=teams.find(x=>x.id===pick?.team_id)||{};

  return (
    <motion.div className="overlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
      {mode==='pick'
        ? <motion.h1 initial={{scale:.6}} animate={{scale:1.05}}>THE PICK IS IN!</motion.h1>
        : <motion.div className="reveal" initial={{y:80}} animate={{y:0}}>
            <h3>{t.name} selects</h3>
            <h1>{p.name}</h1>
            <h2>#{p.random_number}</h2>
            <p>{p.primary_position} / {p.secondary_position}</p>
		<div className="reveal-bottom-left">
  		<div className="reveal-lower-label">ON THE CLOCK</div>
 		 <div className="reveal-lower-team">{currentTeam?.name || "—"}</div>
		</div>

		<div className="reveal-bottom-right">
  		<div className="reveal-lower-label">NEXT PICK</div>
 		 <div className="reveal-lower-team">{nextTeam?.name || "—"}</div>
		</div>
          </motion.div>
      }
    </motion.div>
  );
}

function TV(){
  const[code,setCode]=useState(new URLSearchParams(location.search).get('code')||'');
  const[data,setData]=useState({draft:null,teams:[],players:[],picks:[],queues:[],constraints:[]});

  async function load(){
    const{data:d}=await supabase.from('drafts').select('*').eq('tv_code',code).single();

    if(d){
      const[teams,players,picks]=await Promise.all([
        supabase.from('teams').select('*').eq('draft_id',d.id).order('draft_order'),
        supabase.from('players').select('*').eq('draft_id',d.id),
        supabase.from('picks').select('*').eq('draft_id',d.id).order('pick_number')
      ]);

      setData({
        draft: d,
        teams:teams.data||[],
        players:players.data||[],
        picks:picks.data||[]
      });
    }
  }

  useEffect(()=>{
    if(code){
      load();
      const ch=supabase
        .channel('tv-'+code)
        .on('postgres_changes',{event:'*',schema:'public'},load)
        .subscribe();

      return()=>supabase.removeChannel(ch);
    }
  },[code]);

  if(!code){
    return (
      <div className="login">
        <img src={logo}/>
        <h1>RevealDraft TV</h1>
        <input placeholder="TV code" onChange={e=>setCode(e.target.value)}/>
      </div>
    );
  }

  if(!data)return <div className="loading">Loading TV mode…</div>;

  const {draft,teams,players,picks}=data;

if (!draft) {
  return <div className="loading">Loading TV mode...</div>;
}

if (!data?.draft) {
  return <div className="loading">Loading TV mode...</div>;
}

  const currentTeam=snakeTeamAt(teams,draft.current_pick_index);
  const currentRoster = currentTeam
    ? players.filter(
        (p) =>
          p.drafted_team_id === currentTeam.id ||
          p.assigned_team_id === currentTeam.id
      )
    : [];

  const salaryUsed = currentRoster.reduce(
    (sum, p) => sum + Number(p.salary_value || 0),
    0
  );

  const salaryRemaining =
    Number(draft.salary_cap_amount || 0) - salaryUsed;
  const nextTeam=snakeTeamAt(teams,draft.current_pick_index+1);
  const currentPick=picks.find(p=>p.id===draft.reveal_pick_id);

  return (
    <div className="tv">
      <div className="tv-top">
        <div className="tv-label">CURRENTLY ON THE CLOCK</div>
        <div className="tv-team">{currentTeam?.name || '—'}</div>
      </div>

      <div className="tv-clock">
        <Timer draft={draft}/>
      </div>

      {draft.reveal_pick_id ? (
        <RevealOverlay
          mode="reveal"
          pick={currentPick}
          players={players}
          teams={teams}
        />
      ) : (
        <div className="tv-center">
          <h1>RevealDraft</h1>
          <p>Waiting for next pick...</p>
        </div>
      )}

      <div className="tv-ontheclock">
        <div className="tv-otc-label">
          ON THE CLOCK
        </div>
      
        <div className="tv-otc-team">
          {currentTeam?.name || '—'}
        </div>

{draft?.salary_cap_enabled && (
  <div className="tv-salary-cap">
    Cap Remaining: {salaryRemaining}
  </div>
)}
      </div>

      <div className="tv-bottom">
  <div className="tv-label">NEXT PICK</div>

  <div className="tv-next">
    {nextTeam?.name || '-'}
  </div>

  {draft?.salary_cap_enabled && (
    <div className="tv-cap">
      Cap Remaining: {
        Number(draft.salary_cap_amount || 0) -
        players
          .filter(
            p =>
              p.drafted_team_id === nextTeam?.id ||
              p.assigned_team_id === nextTeam?.id
          )
          .reduce(
            (sum, p) => sum + Number(p.salary_value || 0),
            0
          )
      }
    </div>
  )}
</div>
    </div>
  );
}

function Viewer(){
  const[code,setCode]=useState(new URLSearchParams(location.search).get('code')||'');
  const[data,setData]=useState(null);

  async function load(){
    const{data:d}=await supabase.from('drafts').select('*').eq('tv_code',code).single();

    if(d){
      const[teams,players,picks]=await Promise.all([
        supabase.from('teams').select('*').eq('draft_id',d.id).order('draft_order'),
        supabase.from('players').select('*').eq('draft_id',d.id),
        supabase.from('picks').select('*').eq('draft_id',d.id).order('pick_number')
      ]);

      setData({
        draft:d,
        teams:teams.data||[],
        players:players.data||[],
        picks:picks.data||[]
      });
    }
  }

  useEffect(()=>{
    if(code){
      load();
      const ch=supabase
        .channel('viewer-'+code)
        .on('postgres_changes',{event:'*',schema:'public'},load)
        .subscribe();

      return()=>supabase.removeChannel(ch);
    }
  },[code]);

  if(!code){
    return (
      <div className="login">
        <img src={logo}/>
        <h1>RevealDraft Viewer</h1>
        <input placeholder="Viewer code" onChange={e=>setCode(e.target.value)}/>
      </div>
    );
  }

  if(!data)return <div className="loading">Loading viewer mode…</div>;

  const {draft,teams,players,picks}=data;
  const currentTeam=snakeTeamAt(teams,draft.current_pick_index);

  return (
    <div className="draft">
      <div className="scorebar">
        <h1>{draft.name}</h1>
        <div><b>On the clock:</b> {currentTeam?.name||'—'}</div>
        <Timer draft={draft}/>
        <div className="phase">Phase: {draft.current_phase}</div>
      </div>

<div className="rosters">
  {teams.map((t) => {
    const roster = players.filter(
      (p) =>
        p.drafted_team_id === t.id ||
        p.assigned_team_id === t.id
    );

    const salaryUsed = roster.reduce(
      (sum, p) => sum + Number(p.salary_value || 0),
      0
    );

    const salaryRemaining =
      Number(draft?.salary_cap_amount || 0) - salaryUsed;

    return (
      <div className="panel" key={t.id}>
        <h2>
          {t.logo_url && (
            <img className="teamlogo" src={t.logo_url} />
          )}
          {t.name}
        </h2>

        {draft?.salary_cap_enabled && (
          <div className="team-salary-summary">
            <span>Used: {salaryUsed}</span>
            <span>Remaining: {salaryRemaining}</span>
          </div>
        )}

        <PlayerNames players={roster} />
      </div>
    );
  })}
</div>

      <div className="panel">
        <h2>Pick-by-Pick</h2>
        <PickList picks={picks} players={players} teams={teams}/>
      </div>
    </div>
  );
}

function beep(){
  try{
    new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=').play();
  }catch{}
}

createRoot(document.getElementById('root')).render(<App/>);