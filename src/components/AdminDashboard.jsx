import { useEffect, useState } from "react";
import Papa from "papaparse";
import { supabase } from "../lib/supabase";

export default function AdminDashboard({ profile, onSwitchToDraft }) {
  const [activeTab, setActiveTab] = useState("settings");

  const [drafts, setDrafts] = useState([]);
  const [selectedDraft, setSelectedDraft] = useState(null);

  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [profiles, setProfiles] = useState([]);

  const [draftName, setDraftName] = useState("");
  const [draftType, setDraftType] = useState("coed");
  const [phaseOrder, setPhaseOrder] = useState("female_first");
  const [pickSeconds, setPickSeconds] = useState(90);
  const [status, setStatus] = useState("setup");

  const [teamName, setTeamName] = useState("");
  const [coachUserId, setCoachUserId] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const [playerName, setPlayerName] = useState("");
  const [gender, setGender] = useState("any");
  const [primaryPosition, setPrimaryPosition] = useState("");
  const [secondaryPosition, setSecondaryPosition] = useState("");

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("coach");

  useEffect(() => {
    loadDrafts();
    loadProfiles();
  }, []);

  useEffect(() => {
    if (selectedDraft?.id) {
      loadTeams();
      loadPlayers();
    }
  }, [selectedDraft]);

  async function loadDrafts() {
    const { data, error } = await supabase
      .from("drafts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return alert(error.message);

    setDrafts(data || []);

    if (data?.length && !selectedDraft) {
      setSelectedDraft(data[0]);
      loadDraftIntoForm(data[0]);
    }
  }

  async function loadProfiles() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("email");

    if (error) return alert(error.message);

    setProfiles(data || []);
  }

  function loadDraftIntoForm(draft) {
    if (!draft) return;

    setDraftName(draft.name || "");
    setDraftType(draft.type || "coed");

    if (Array.isArray(draft.phase_order)) {
      setPhaseOrder(
        draft.phase_order[0] === "female"
          ? "female_first"
          : "male_first"
      );
    }

    setPickSeconds(draft.pick_seconds || 90);
    setStatus(draft.status || "setup");
  }

  async function loadTeams() {
    if (!selectedDraft?.id) return;

    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("draft_id", selectedDraft.id)
      .order("draft_order");

    if (error) return alert(error.message);

    setTeams(data || []);
  }

  async function loadPlayers() {
    if (!selectedDraft?.id) return;

    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("draft_id", selectedDraft.id)
      .order("random_number");

    if (error) return alert(error.message);

    setPlayers(data || []);
  }

  function getPhaseArray() {
    if (phaseOrder === "female_first") {
      return ["female", "male"];
    }

    if (phaseOrder === "male_first") {
      return ["male", "female"];
    }

    return ["any"];
  }

  async function createDraft() {
    const phaseArray = getPhaseArray();

    const { data, error } = await supabase
      .from("drafts")
      .insert({
        name: draftName || "New Draft",
        type: draftType,
        current_phase:
          draftType === "coed"
            ? phaseArray[0]
            : "any",
        phase_order: phaseArray,
        pick_seconds: Number(pickSeconds),
        status,
        current_pick_index: 0,
      })
      .select()
      .single();

    if (error) return alert(error.message);

    setSelectedDraft(data);

    await loadDrafts();

    alert("Draft created");
  }

  async function updateDraft() {
    if (!selectedDraft) {
      return alert("Select a draft first");
    }

    const phaseArray = getPhaseArray();

    const { error } = await supabase
      .from("drafts")
      .update({
        name: draftName,
        type: draftType,
        current_phase:
          draftType === "coed"
            ? phaseArray[0]
            : "any",
        phase_order: phaseArray,
        pick_seconds: Number(pickSeconds),
        status,
      })
      .eq("id", selectedDraft.id);

    if (error) return alert(error.message);

    await loadDrafts();

    alert("Draft updated");
  }

async function resetDraftProgressOnly() {
  if (!selectedDraft) {
    return alert("Select a draft first");
  }

  const confirmation = window.prompt(
    `This will erase completed picks and coach queues for "${selectedDraft.name}". Type RESET PICKS to confirm.`
  );

  if (confirmation !== "RESET PICKS") {
    return alert("Reset cancelled");
  }

  const { error } = await supabase.rpc("reset_draft_picks", {
    target_draft_id: selectedDraft.id,
  });

  if (error) {
    console.error(error);
    return alert(error.message);
  }

  await loadPlayers();
  await loadTeams();
  await loadDrafts();

  alert("Draft picks and queues reset");
}

  async function resetEntireDraft() {
    if (!selectedDraft) {
      return alert("Select a draft first");
    }

    const confirmation = window.prompt(
      `DANGER: This will delete ALL teams, players, picks, queues, and draft order for "${selectedDraft.name}". Type DELETE DRAFT DATA to confirm.`
    );

    if (confirmation !== "DELETE DRAFT DATA") {
      return alert("Reset cancelled");
    }

    const { error } = await supabase.rpc(
      "reset_entire_draft",
      {
        target_draft_id: selectedDraft.id,
      }
    );

    if (error) {
      console.error(error);
      return alert(error.message);
    }

    await loadPlayers();
    await loadTeams();
    await loadDrafts();

    alert("Entire draft data reset");
  }

  async function randomizeDraftOrder() {
    if (!selectedDraft) {
      return alert("Select a draft first");
    }

    const shuffled = [...teams].sort(
      () => Math.random() - 0.5
    );

    for (let i = 0; i < shuffled.length; i++) {
      await supabase
        .from("teams")
        .update({
          draft_order: i + 1,
        })
        .eq("id", shuffled[i].id);
    }

    await loadTeams();

    alert("Draft order randomized");
  }

  async function randomizePlayerNumbers() {
    if (!selectedDraft) {
      return alert("Select a draft first");
    }

    const shuffled = [...players].sort(
      () => Math.random() - 0.5
    );

    for (let i = 0; i < shuffled.length; i++) {
      await supabase
        .from("players")
        .update({
          random_number: i + 1,
        })
        .eq("id", shuffled[i].id);
    }

    await loadPlayers();

    alert("Player numbers randomized");
  }

  async function addTeam() {
    if (!selectedDraft) {
      return alert("Select a draft first");
    }

    const { error } = await supabase
      .from("teams")
      .insert({
        draft_id: selectedDraft.id,
        name: teamName,
        coach_user_id: coachUserId || null,
        logo_url: logoUrl || null,
        draft_order: teams.length + 1,
      });

    if (error) return alert(error.message);

    setTeamName("");
    setCoachUserId("");
    setLogoUrl("");

    await loadTeams();
  }

  async function updateTeamCoach(teamId, coachId) {
    const { error } = await supabase
      .from("teams")
      .update({
        coach_user_id: coachId || null,
      })
      .eq("id", teamId);

    if (error) return alert(error.message);

    await loadTeams();
  }

  async function updateTeamLogoUrl(teamId, value) {
    const { error } = await supabase
      .from("teams")
      .update({
        logo_url: value,
      })
      .eq("id", teamId);

    if (error) return alert(error.message);

    await loadTeams();
  }

  async function uploadTeamLogo(teamId, file) {
    if (!file) return;

    const fileExt = file.name.split(".").pop();

    const filePath = `${teamId}-${Date.now()}.${fileExt}`;

    const { error: uploadError } =
      await supabase.storage
        .from("team-logos")
        .upload(filePath, file, {
          upsert: true,
        });

    if (uploadError) {
      return alert(uploadError.message);
    }

    const { data } = supabase.storage
      .from("team-logos")
      .getPublicUrl(filePath);

    const publicUrl = data.publicUrl;

    const { error: updateError } =
      await supabase
        .from("teams")
        .update({
          logo_url: publicUrl,
        })
        .eq("id", teamId);

    if (updateError) {
      return alert(updateError.message);
    }

    await loadTeams();

    alert("Logo uploaded");
  }

  async function addPlayer() {
    if (!selectedDraft) {
      return alert("Select a draft first");
    }

    const nextNumber = players.length + 1;

    const { error } = await supabase
      .from("players")
      .insert({
        draft_id: selectedDraft.id,
        name: playerName,
        gender,
        primary_position: primaryPosition,
        secondary_position:
          secondaryPosition,
        random_number: nextNumber,
        is_coach: false,
      });

    if (error) return alert(error.message);

    setPlayerName("");
    setPrimaryPosition("");
    setSecondaryPosition("");

    await loadPlayers();
  }

  async function createUser() {
    const { data, error } =
      await supabase.functions.invoke(
        "create-user",
        {
          body: {
            email: newUserEmail,
            password: newUserPassword,
            role: newUserRole,
          },
        }
      );

    if (error) return alert(error.message);

    if (!data.success) {
      return alert(data.error);
    }

    alert("User created");

    setNewUserEmail("");
    setNewUserPassword("");

    await loadProfiles();
  }

  async function updateRole(id, role) {
    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", id);

    if (error) return alert(error.message);

    await loadProfiles();
  }

function getPublicLink(path) {
  if (!selectedDraft?.tv_code) return "";

  return `${window.location.origin}${path}?code=${selectedDraft.tv_code}`;
}

async function copyLink(path) {
  const link = getPublicLink(path);

  if (!link) return alert("This draft does not have a TV/viewer code yet.");

  await navigator.clipboard.writeText(link);
  alert("Link copied");
}

function openLink(path) {
  const link = getPublicLink(path);

  if (!link) return alert("This draft does not have a TV/viewer code yet.");

  window.open(link, "_blank");
}

  async function importCsv(e, type) {
    const file = e.target.files[0];

    if (!file || !selectedDraft) return;

    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        if (type === "players") {
          const rows = results.data
            .filter((x) => x.name)
            .map((x, i) => ({
              draft_id: selectedDraft.id,
              name: x.name,
              gender: (
                x.gender || "any"
              ).toLowerCase(),
              primary_position:
                x.primary_position || "",
              secondary_position:
                x.secondary_position || "",
              random_number:
                players.length + i + 1,
              is_coach: false,
            }));

          const { error } = await supabase
            .from("players")
            .insert(rows);

          if (error) return alert(error.message);

          await loadPlayers();
        }

        if (type === "teams") {
          const rows = results.data
            .filter((x) => x.name)
            .map((x, i) => ({
              draft_id: selectedDraft.id,
              name: x.name,
              logo_url: x.logo_url || null,
              draft_order:
                teams.length + i + 1,
            }));

          const { error } = await supabase
            .from("teams")
            .insert(rows);

          if (error) return alert(error.message);

          await loadTeams();
        }

        alert("Import complete");
      },
    });
  }

  return (
    <div className="admin-page">
      <aside className="admin-sidebar">
        <h2>RevealDraft</h2>

        <button onClick={() => setActiveTab("settings")}>
          Draft Settings
        </button>

        <button onClick={() => setActiveTab("teams")}>
          Teams
        </button>

        <button onClick={() => setActiveTab("players")}>
          Players
        </button>

        <button onClick={() => setActiveTab("users")}>
          Users
        </button>

        <button onClick={() => setActiveTab("import")}>
          Import / Export
        </button>

        <button onClick={onSwitchToDraft}>
          Live Draft View
        </button>

	<button onClick={() => setActiveTab("links")}>
  	  Viewing Links
	</button>
      </aside>

      <main className="admin-main">
        <h1>Admin Dashboard</h1>

        <p>{profile?.email}</p>

        <select
          value={selectedDraft?.id || ""}
          onChange={(e) => {
            const found = drafts.find(
              (d) => d.id === e.target.value
            );

            setSelectedDraft(found);

            loadDraftIntoForm(found);
          }}
        >
          <option value="">
            Select Draft
          </option>

          {drafts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

	{activeTab === "links" && (
	  <section className="admin-card">
	    <h2>Viewing Links</h2>

	    {!selectedDraft?.tv_code ? (
	      <p>No viewing code found for this draft.</p>
	    ) : (
	      <>
	        <p>
	          <b>Viewing Code:</b> {selectedDraft.tv_code}
	        </p>

	        <h3>TV / Projection Mode</h3>
	        <p>{getPublicLink("/tv")}</p>
	        <button onClick={() => openLink("/tv")}>Open TV Mode</button>
	        <button onClick={() => copyLink("/tv")}>Copy TV Link</button>

	        <h3>Viewer Mode</h3>
	        <p>{getPublicLink("/viewer")}</p>
	        <button onClick={() => openLink("/viewer")}>Open Viewer Mode</button>
	        <button onClick={() => copyLink("/viewer")}>Copy Viewer Link</button>
	      </>
	    )}
	  </section>
	)}

        {activeTab === "settings" && (
          <section className="admin-card">
            <h2>Draft Settings</h2>

            <input
              placeholder="Draft Name"
              value={draftName}
              onChange={(e) =>
                setDraftName(e.target.value)
              }
            />

            <select
              value={draftType}
              onChange={(e) =>
                setDraftType(e.target.value)
              }
            >
              <option value="coed">Coed</option>
              <option value="male_female">
                Male/Female
              </option>
            </select>

            <select
              value={phaseOrder}
              onChange={(e) =>
                setPhaseOrder(e.target.value)
              }
            >
              <option value="female_first">
                Females First
              </option>

              <option value="male_first">
                Males First
              </option>
            </select>

            <input
              type="number"
              value={pickSeconds}
              onChange={(e) =>
                setPickSeconds(e.target.value)
              }
            />

            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value)
              }
            >
              <option value="setup">Setup</option>
              <option value="live">Live</option>
              <option value="paused">Paused</option>
              <option value="complete">Complete</option>
            </select>

            <div className="admin-actions">
              <button onClick={createDraft}>
                Create Draft
              </button>

              <button onClick={updateDraft}>
                Save Settings
              </button>

              <button onClick={randomizeDraftOrder}>
                Randomize Draft Order
              </button>

              <button onClick={randomizePlayerNumbers}>
                Randomize Player Numbers
              </button>

              <button
                onClick={resetDraftProgressOnly}
                style={{ background: "#b91c1c" }}
              >
                Reset Picks & Queues
              </button>

              <button
                onClick={resetEntireDraft}
                style={{ background: "#7f1d1d" }}
              >
                Reset Entire Draft
              </button>
            </div>
          </section>
        )}

        {activeTab === "teams" && (
          <section className="admin-card">
            <h2>Teams</h2>

            <input
              placeholder="Team name"
              value={teamName}
              onChange={(e) =>
                setTeamName(e.target.value)
              }
            />

            <select
              value={coachUserId}
              onChange={(e) =>
                setCoachUserId(e.target.value)
              }
            >
              <option value="">
                No coach assigned
              </option>

              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.email}
                </option>
              ))}
            </select>

            <input
              placeholder="Logo URL"
              value={logoUrl}
              onChange={(e) =>
                setLogoUrl(e.target.value)
              }
            />

            <button onClick={addTeam}>
              Add Team
            </button>

            {teams.length === 0 ? (
              <p>No teams entered.</p>
            ) : (
teams.map((t) => (
  <div key={t.id} className="admin-row">
    <span>
      {t.logo_url && (
        <img
          src={t.logo_url}
          alt={t.name}
          style={{
            width: 36,
            height: 36,
            objectFit: "contain",
            marginRight: 8,
            verticalAlign: "middle",
          }}
        />
      )}
      {t.draft_order}. {t.name}
    </span>

    <select
      value={t.coach_user_id || ""}
      onChange={(e) => updateTeamCoach(t.id, e.target.value)}
    >
      <option value="">No coach assigned</option>
      {profiles.map((p) => (
        <option key={p.id} value={p.id}>
          {p.email} — {p.role}
        </option>
      ))}
    </select>

    <input
      placeholder="Logo URL"
      defaultValue={t.logo_url || ""}
      onBlur={(e) => updateTeamLogoUrl(t.id, e.target.value)}
    />

    <input
      type="file"
      accept="image/*"
      onChange={(e) => uploadTeamLogo(t.id, e.target.files[0])}
    />
  </div>
))
            )}
          </section>
        )}

        {activeTab === "players" && (
          <section className="admin-card">
            <h2>Players</h2>

            <input
              placeholder="Player name"
              value={playerName}
              onChange={(e) =>
                setPlayerName(e.target.value)
              }
            />

            <button onClick={addPlayer}>
              Add Player
            </button>

            {players.length === 0 ? (
              <p>No players entered.</p>
            ) : (
              players.map((p) => (
                <div key={p.id}>
                  #{p.random_number} - {p.name}
                </div>
              ))
            )}
          </section>
        )}

        {activeTab === "users" && (
          <section className="admin-card">
            <h2>Users</h2>

            <h3>Create User</h3>

            <input
              placeholder="Email"
              value={newUserEmail}
              onChange={(e) =>
                setNewUserEmail(e.target.value)
              }
            />

            <input
              type="password"
              placeholder="Password"
              value={newUserPassword}
              onChange={(e) =>
                setNewUserPassword(e.target.value)
              }
            />

            <select
              value={newUserRole}
              onChange={(e) =>
                setNewUserRole(e.target.value)
              }
            >
              <option value="admin">admin</option>
              <option value="commissioner">
                commissioner
              </option>
              <option value="coach">
                coach
              </option>
              <option value="viewer">
                viewer
              </option>
            </select>

            <button onClick={createUser}>
              Create User
            </button>

            <h3>Existing Users</h3>

            {profiles.length === 0 ? (
              <p>No users found.</p>
            ) : (
              profiles.map((p) => (
                <div
                  key={p.id}
                  className="admin-row"
                >
                  <span>{p.email}</span>

                  <select
                    value={p.role || "coach"}
                    onChange={(e) =>
                      updateRole(
                        p.id,
                        e.target.value
                      )
                    }
                  >
                    <option value="admin">
                      admin
                    </option>

                    <option value="commissioner">
                      commissioner
                    </option>

                    <option value="coach">
                      coach
                    </option>

                    <option value="viewer">
                      viewer
                    </option>
                  </select>
                </div>
              ))
            )}
          </section>
        )}

        {activeTab === "import" && (
          <section className="admin-card">
            <h2>Import / Export</h2>

            <label>
              Import Player CSV
            </label>

            <input
              type="file"
              accept=".csv"
              onChange={(e) =>
                importCsv(e, "players")
              }
            />

            <label>
              Import Team CSV
            </label>

            <input
              type="file"
              accept=".csv"
              onChange={(e) =>
                importCsv(e, "teams")
              }
            />
          </section>
        )}
      </main>
    </div>
  );
}