import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function AdminDashboard({ profile }) {
  const [drafts, setDrafts] = useState([]);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [draftName, setDraftName] = useState("");
  const [draftType, setDraftType] = useState("coed");
  const [phaseOrder, setPhaseOrder] = useState("female_first");
  const [pickSeconds, setPickSeconds] = useState(90);
  const [status, setStatus] = useState("setup");

  useEffect(() => {
    loadDrafts();
  }, []);

  async function loadDrafts() {
    const { data, error } = await supabase
      .from("drafts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Error loading drafts");
      return;
    }

    setDrafts(data || []);
    if (data?.length && !selectedDraft) {
      setSelectedDraft(data[0]);
      loadDraftIntoForm(data[0]);
    }
  }

  function loadDraftIntoForm(draft) {
    setDraftName(draft.name || "");
    setDraftType(draft.draft_type || "coed");
    setPhaseOrder(draft.phase_order || "female_first");
    setPickSeconds(draft.pick_seconds || 90);
    setStatus(draft.status || "setup");
  }

  async function createDraft() {
    const { data, error } = await supabase
      .from("drafts")
      .insert({
        name: draftName || "New Draft",
        draft_type: draftType,
        phase_order: phaseOrder,
        pick_seconds: Number(pickSeconds),
        status,
        current_pick_index: 0,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      alert("Error creating draft");
      return;
    }

    setSelectedDraft(data);
    await loadDrafts();
    alert("Draft created");
  }

  async function updateDraft() {
    if (!selectedDraft) return alert("Select a draft first");

    const { error } = await supabase
      .from("drafts")
      .update({
        name: draftName,
        draft_type: draftType,
        phase_order: phaseOrder,
        pick_seconds: Number(pickSeconds),
        status,
      })
      .eq("id", selectedDraft.id);

    if (error) {
      console.error(error);
      alert("Error updating draft");
      return;
    }

    await loadDrafts();
    alert("Draft settings saved");
  }

  async function randomizeDraftOrder() {
    if (!selectedDraft) return alert("Select a draft first");

    const { data: teams, error } = await supabase
      .from("teams")
      .select("*")
      .eq("draft_id", selectedDraft.id);

    if (error) {
      console.error(error);
      alert("Error loading teams");
      return;
    }

    const shuffled = [...teams].sort(() => Math.random() - 0.5);

    for (let i = 0; i < shuffled.length; i++) {
      await supabase
        .from("teams")
        .update({ draft_order: i + 1 })
        .eq("id", shuffled[i].id);
    }

    alert("Draft order randomized");
  }

  async function randomizePlayerNumbers() {
    if (!selectedDraft) return alert("Select a draft first");

    const { data: players, error } = await supabase
      .from("players")
      .select("*")
      .eq("draft_id", selectedDraft.id)
      .eq("is_coach", false);

    if (error) {
      console.error(error);
      alert("Error loading players");
      return;
    }

    const numbers = players.map((_, index) => index + 1).sort(() => Math.random() - 0.5);

    for (let i = 0; i < players.length; i++) {
      await supabase
        .from("players")
        .update({ random_number: numbers[i] })
        .eq("id", players[i].id);
    }

    alert("Player numbers randomized");
  }

  return (
    <div className="admin-page">
      <aside className="admin-sidebar">
        <h2>RevealDraft</h2>
        <p>Admin Dashboard</p>

        <button>Draft Settings</button>
        <button>Teams</button>
        <button>Players</button>
        <button>Users</button>
        <button>Import / Export</button>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h1>Admin Dashboard</h1>
            <p>Logged in as {profile?.email}</p>
          </div>
        </header>

        <section className="admin-card">
          <h2>Draft Settings</h2>

          <label>Existing Drafts</label>
          <select
            value={selectedDraft?.id || ""}
            onChange={(e) => {
              const draft = drafts.find((d) => d.id === e.target.value);
              setSelectedDraft(draft);
              loadDraftIntoForm(draft);
            }}
          >
            <option value="">Select draft</option>
            {drafts.map((draft) => (
              <option key={draft.id} value={draft.id}>
                {draft.name}
              </option>
            ))}
          </select>

          <label>Draft Name</label>
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Spring Coed Draft"
          />

          <label>Draft Type</label>
          <select value={draftType} onChange={(e) => setDraftType(e.target.value)}>
            <option value="coed">Coed</option>
            <option value="male_female">Male/Female</option>
          </select>

          <label>Coed Phase Order</label>
          <select value={phaseOrder} onChange={(e) => setPhaseOrder(e.target.value)}>
            <option value="female_first">Females First</option>
            <option value="male_first">Males First</option>
            <option value="all">All Players</option>
          </select>

          <label>Pick Timer Seconds</label>
          <input
            type="number"
            value={pickSeconds}
            onChange={(e) => setPickSeconds(e.target.value)}
          />

          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="setup">Setup</option>
            <option value="live">Live</option>
            <option value="paused">Paused</option>
            <option value="complete">Complete</option>
          </select>

          <div className="admin-actions">
            <button onClick={createDraft}>Create New Draft</button>
            <button onClick={updateDraft}>Save Settings</button>
            <button onClick={randomizeDraftOrder}>Randomize Draft Order</button>
            <button onClick={randomizePlayerNumbers}>Randomize Player Numbers</button>
          </div>
        </section>
      </main>
    </div>
  );
}