import { useEffect, useState } from "react";
import Papa from "papaparse";
import { supabase } from "../lib/supabase";

export default function AdminDashboard({ profile, onSwitchToDraft,onOpenUserManagement }) {
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
  const [coachEmailMessage, setCoachEmailMessage] = useState("");
  const [playerEmailMessage, setPlayerEmailMessage] = useState("");
  const [emailSignature, setEmailSignature] = useState("");

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

  const [accessRows, setAccessRows] = useState([]);
  const [accessDraftId, setAccessDraftId] = useState("");
  const [accessUserId, setAccessUserId] = useState("");

  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");

  const [keeperPlayerId, setKeeperPlayerId] = useState("");
  const [keeperTeamId, setKeeperTeamId] = useState("");
  const [keeperRound, setKeeperRound] = useState(1);
  const [keeperPhase, setKeeperPhase] = useState("any");
  const [keeperIsCoach, setKeeperIsCoach] = useState(false);

  const [positionConstraints, setPositionConstraints] = useState([]);
  const [constraintPosition, setConstraintPosition] = useState("");
  const [constraintMin, setConstraintMin] = useState("");
  const [constraintMax, setConstraintMax] = useState("");

  const [salaryCapType, setSalaryCapType] = useState("none");
  const [salaryCapAmount, setSalaryCapAmount] = useState("");

  const [salaryValue, setSalaryValue] = useState("");

  const [playerIsCoach, setPlayerIsCoach] = useState("no");

  const [auditLogs, setAuditLogs] = useState([]);

  const [coachInvites, setCoachInvites] = useState([]);

  const [autoPickMode, setAutoPickMode] = useState("disabled");

  const setupChecklist = [
    {
      label: "Draft created",
      done: !!selectedDraft?.id,
    },
    {
      label: "Draft settings saved",
      done: !!selectedDraft?.type && !!selectedDraft?.pick_seconds,
    },
    {
      label: "Teams added",
      done: teams.length > 0,
    },
    {
      label: "Players added",
      done: players.length > 0,
    },
    {
      label: "Coaches assigned to teams",
      done:
        teams.length > 0 &&
        teams.every((t) => !!t.coach_user_id),
    },
    {
      label: "Draft order randomized",
      done:
        teams.length > 0 &&
        teams.every((t) => t.draft_order !== null && t.draft_order !== undefined),
    },
    {
      label: "TV / Viewer links ready",
      done: !!selectedDraft?.tv_code,
    },
  ];

  const setupComplete = setupChecklist.every((item) => item.done);

  useEffect(() => {
    loadDrafts();
    loadProfiles();
    loadCommissionerAccess();
  }, []);

  useEffect(() => {
    if (selectedDraft?.id) {
      loadTeams();
      loadPlayers();
      loadPositionConstraints();
      loadAuditLogs();
      loadCoachInvites();
    }
  }, [selectedDraft]);

async function loadAuditLogs() {
  if (!selectedDraft?.id) return;

  const { data, error } = await supabase
    .from("audit_logs")
    .select("*, profiles(email, first_name, last_name)")
    .eq("draft_id", selectedDraft.id)
    .order("created_at", { ascending: false });

  if (error) return alert(error.message);

  setAuditLogs(data || []);
}

async function sendCoachInvite(team) {

  const existingInvite = coachInvites.find(
    (invite) => invite.team_id === team.id
  );
  
  if (existingInvite) {
    return alert(
      `There is already a pending invite for ${existingInvite.email}. Clear it before sending another.`
    );
  }

  const email = window.prompt(`Enter coach email for ${team.name}:`);
  if (!email) return;

  const token = crypto.randomUUID();

  const { error } = await supabase.from("coach_invites").insert({
    email,
    draft_id: selectedDraft.id,
    team_id: team.id,
    token,
  });

  if (error) return alert(error.message);

  const inviteUrl = `${window.location.origin}/invite?token=${token}`;

  const response = await fetch("/api/send-coach-invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: email,
      inviteUrl,
      draftName: selectedDraft.name,
      teamName: team.name,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error(result);
    return alert(result.error || "Invite email failed");
  }

  alert("Coach invite sent");

  await loadCoachInvites();
}

async function sendTestCoachEmail() {
  if (!profile?.email) {
    return alert("No signed-in user email found.");
  }

  const response = await fetch("/api/send-results", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      to: profile.email,

      subject: `${draftName} - Coach Email Preview`,

      html: `
        <div style="font-family:Arial,sans-serif;padding:24px;line-height:1.5;">
          <h1>RevealDraft Coach Email Preview</h1>

          <p>
            Your draft roster for
            <strong>${draftName}</strong>
            is below.
          </p>

          ${
            coachEmailMessage
              ? `
                <div style="
                  background:#fef3c7;
                  border:1px solid #f59e0b;
                  border-radius:12px;
                  padding:14px;
                  margin:16px 0;
                  color:#78350f;
                ">
                  ${coachEmailMessage.replace(/\n/g, "<br/>")}
                </div>
              `
              : ""
          }

          <h2>Sample Team Roster</h2>

          <ul>
            <li>Jane Smith — SS</li>
            <li>Mike Johnson — OF</li>
            <li>Sarah Williams — 2B</li>
          </ul>

          ${
            emailSignature
              ? `
                <hr style="margin-top:24px"/>
                <p>
                  ${emailSignature.replace(/\n/g, "<br/>")}
                </p>
              `
              : ""
          }
        </div>
      `,
    }),
  });

  if (!response.ok) {
    return alert("Failed to send test coach email.");
  }

  alert(`Test coach email sent to ${profile.email}`);
}

async function sendTestPlayerEmail() {
  if (!profile?.email) {
    return alert("No signed-in user email found.");
  }

  const response = await fetch("/api/send-results", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      to: profile.email,

      subject: `${draftName} - Player Email Preview`,

      html: `
        <div style="font-family:Arial,sans-serif;padding:24px;line-height:1.5;">
          <h1>RevealDraft Player Email Preview</h1>

          <p>
            You were drafted to
            <strong>Team Demo</strong>
            in
            <strong>${draftName}</strong>.
          </p>

          ${
            playerEmailMessage
              ? `
                <div style="
                  background:#dbeafe;
                  border:1px solid #60a5fa;
                  border-radius:12px;
                  padding:14px;
                  margin:16px 0;
                  color:#1e3a8a;
                ">
                  ${playerEmailMessage.replace(/\n/g, "<br/>")}
                </div>
              `
              : ""
          }

          <h2>Coach Information</h2>

          <p>
            Coach: John Doe<br/>
            Email: coach@example.com<br/>
            Phone: (555) 555-5555<br/>
            Facebook: facebook.com/johndoe
          </p>

          ${
            emailSignature
              ? `
                <hr style="margin-top:24px"/>
                <p>
                  ${emailSignature.replace(/\n/g, "<br/>")}
                </p>
              `
              : ""
          }
        </div>
      `,
    }),
  });

  if (!response.ok) {
    return alert("Failed to send test player email.");
  }

  alert(`Test player email sent to ${profile.email}`);
}

async function clearCoachInvite(inviteId) {
  const confirmClear = window.confirm("Clear this pending coach invite?");
  if (!confirmClear) return;

  const { error } = await supabase
    .from("coach_invites")
    .delete()
    .eq("id", inviteId);

  if (error) return alert(error.message);

  await loadCoachInvites();
}

async function updateProfileField(id, field, value) {
  const { error } = await supabase
    .from("profiles")
    .update({
      [field]: value,
    })
    .eq("id", id);

  if (error) {
    console.error(error);
    alert(error.message);
  }
}

async function savePositionConstraint() {
  if (!selectedDraft) return alert("Select a draft first");
  if (!constraintPosition) return alert("Position is required");

  const { error } = await supabase
    .from("draft_position_constraints")
    .upsert({
      draft_id: selectedDraft.id,
      position: constraintPosition.trim().toUpperCase(),
      min_count: constraintMin === "" ? null : Number(constraintMin),
      max_count: constraintMax === "" ? null : Number(constraintMax),
    });

  if (error) return alert(error.message);

  setConstraintPosition("");
  setConstraintMin("");
  setConstraintMax("");

  await loadPositionConstraints();

  alert("Position constraint saved");
}

async function removePositionConstraint(id) {
  const { error } = await supabase
    .from("draft_position_constraints")
    .delete()
    .eq("id", id);

  if (error) return alert(error.message);

  await loadPositionConstraints();
}

async function assignKeeperPlayer() {
  if (!keeperPlayerId || !keeperTeamId || !keeperRound) {
    return alert("Select a player, team, and round");
  }

  const { error } = await supabase
    .from("players")
    .update({
      assigned_team_id: keeperTeamId,
      keeper_round: Number(keeperRound),
      keeper_phase: keeperPhase,
      is_coach: keeperIsCoach,
      keeper_note: keeperIsCoach ? "Coach pre-draft assignment" : "Keeper assignment",
    })
    .eq("id", keeperPlayerId);

  if (error) return alert(error.message);

  setKeeperPlayerId("");
  setKeeperTeamId("");
  setKeeperRound(1);
  setKeeperPhase("any");
  setKeeperIsCoach(false);

  await loadPlayers();

  alert("Player assignment saved");
}

async function removeKeeperAssignment(playerId) {
  const confirmRemove = window.confirm("Remove this pre-draft assignment?");
  if (!confirmRemove) return;

  const { error } = await supabase
    .from("players")
    .update({
      assigned_team_id: null,
      keeper_round: null,
      keeper_phase: null,
      keeper_note: null,
      is_coach: false,
    })
    .eq("id", playerId);

  if (error) return alert(error.message);

  await loadPlayers();
}

async function loadDrafts() {
  let query;

  if (profile?.role === "admin") {
    query = supabase
      .from("drafts")
      .select("*")
      .order("created_at", { ascending: false });
  } else if (profile?.role === "commissioner") {
    const { data: accessRows, error: accessError } = await supabase
      .from("draft_commissioners")
      .select("draft_id")
      .eq("user_id", profile.id);

    if (accessError) {
      return alert(accessError.message);
    }

    const draftIds = accessRows.map((x) => x.draft_id);

    query = supabase
      .from("drafts")
      .select("*")
      .in("id", draftIds)
      .order("created_at", { ascending: false });
  } else {
    setDrafts([]);
    return;
  }

  const { data, error } = await query;

  if (error) {
    return alert(error.message);
  }

  setDrafts(data || []);

  if (data?.length && !selectedDraft) {
    setSelectedDraft(data[0]);
    loadDraftIntoForm(data[0]);
  }
}

async function loadCommissionerAccess() {
  const { data, error } = await supabase
    .from("draft_commissioners")
    .select("id, draft_id, user_id")
    .order("created_at", { ascending: false });

  if (error) return alert(error.message);

  setAccessRows(data || []);
}

async function loadPositionConstraints() {
  if (!selectedDraft?.id) return;

  const { data, error } = await supabase
    .from("draft_position_constraints")
    .select("*")
    .eq("draft_id", selectedDraft.id)
    .order("position");

  if (error) return alert(error.message);

  setPositionConstraints(data || []);
}

async function grantCommissionerAccess() {
  if (!accessDraftId || !accessUserId) {
    return alert("Select a draft and commissioner");
  }

  const { error } = await supabase
    .from("draft_commissioners")
    .insert({
      draft_id: accessDraftId,
      user_id: accessUserId,
    });

  if (error) return alert(error.message);

  setAccessDraftId("");
  setAccessUserId("");
  await loadCommissionerAccess();

  alert("Access granted");
}

async function removeCommissionerAccess(id) {
  const confirmRemove = window.confirm("Remove this commissioner's access?");
  if (!confirmRemove) return;

  const { error } = await supabase
    .from("draft_commissioners")
    .delete()
    .eq("id", id);

  if (error) return alert(error.message);

  await loadCommissionerAccess();
}

	async function resetUserPassword(userId, email) {
	  const password = window.prompt(`Enter a new temporary password for ${email}`);

	  if (!password) return alert("Password reset cancelled");

	  if (password.length < 6) {
	    return alert("Password must be at least 6 characters");
	  }

	  const { data, error } = await supabase.functions.invoke("reset-user-password", {
	    body: {
	      userId,
	      password,
	    },
	  });

	  if (error) return alert(error.message);

	  if (!data?.success) {
	    return alert(data?.error || "Password reset failed");
	  }

	  alert(`Password reset for ${email}`);
	}

  async function loadProfiles() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("email");

    if (error) return alert(error.message);

    setProfiles(data || []);
  }

async function completeDraft() {
  if (!selectedDraft?.id) return alert("Select a draft first.");

  const confirmComplete = window.confirm(
    "Complete this draft? This will stop live drafting but keep all results and rosters."
  );

  if (!confirmComplete) return;

  const { error } = await supabase
    .from("drafts")
    .update({
      status: "completed",
    })
    .eq("id", selectedDraft.id);

  if (error) return alert(error.message);

  await logAdminAudit("draft_completed", {
    draft_name: selectedDraft.name,
  });

  await loadDrafts();

  alert("Draft completed.");
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
    setSalaryCapType(
      draft.salary_cap_enabled ? "salary_cap" : "none"
    );
    setSalaryCapAmount(draft.salary_cap_amount || "");
    setPickSeconds(draft.pick_seconds || 90);
    setStatus(draft.status || "setup");
  }

  async function loadCoachInvites() {
    if (!selectedDraft?.id) return;

    const { data, error } = await supabase
      .from("coach_invites")
      .select("*")
      .eq("draft_id", selectedDraft.id)
      .eq("accepted", false);

    if (error) return alert(error.message);

    setCoachInvites(data || []);
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
	salary_cap_enabled: salaryCapType === "salary_cap",
	salary_cap_amount:
	  salaryCapType === "salary_cap"
	    ? Number(salaryCapAmount || 0)
	    : null,
	auto_pick_mode: autoPickMode,

	coach_email_message: coachEmailMessage,
	player_email_message: playerEmailMessage,
	email_signature: emailSignature,
      })
      .select()
      .single();

    if (error) return alert(error.message);

    setSelectedDraft(data);

    await loadDrafts();

    alert("Draft created");
  }

  async function updatePlayer(playerId, fields) {
    const { error } = await supabase
      .from("players")
      .update(fields)
      .eq("id", playerId);

    if (error) return alert(error.message);
  
    await loadPlayers();
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
	salary_cap_enabled: salaryCapType === "salary_cap",
	salary_cap_amount:
	  salaryCapType === "salary_cap"
	    ? Number(salaryCapAmount || 0)
	    : null,

        coach_email_message:
          coachEmailMessage,

        player_email_message:
          playerEmailMessage,

        email_signature:
          emailSignature,
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

  await logAdminAudit("reset_picks_and_queues", {
    draft_name: selectedDraft.name,
  });

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

  await logAdminAudit("reset_entire_draft", {
    draft_name: selectedDraft.name,
  });

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
	salary_value: salaryValue === "" ? null : Number(salaryValue),
      });

    if (error) return alert(error.message);

    setPlayerName("");
    setPrimaryPosition("");
    setSecondaryPosition("");
    setSalaryValue("");

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
	    first_name: newFirstName,
	    last_name: newLastName,
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
    setNewFirstName("");
    setNewLastName("");

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

async function logAdminAudit(action, details = {}) {
  if (!selectedDraft?.id || !profile?.id) return;

  await supabase.from("audit_logs").insert({
    draft_id: selectedDraft.id,
    user_id: profile.id,
    action,
    details,
  });
}

  return (
    <div className="admin-page">
      <aside className="admin-sidebar">
        <h2>RevealDraft</h2>

        <button onClick={() => setActiveTab("settings")}>
          Draft Settings
        </button>

	<button onClick={() => setActiveTab("constraints")}>
	  Position Constraints
	</button>

        <button onClick={() => setActiveTab("teams")}>
          Teams
        </button>

        <button onClick={() => setActiveTab("players")}>
          Players
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

	<button onClick={() => setActiveTab("keepers")}>
	  Keepers / Coach Picks
	</button>

	<button onClick={() => setActiveTab("setupChecklist")}>
	  Setup Checklist
	</button>

	<button onClick={() => setActiveTab("commissionerAccess")}>
	  Commissioner Access
	</button>

	{profile?.role === "admin" && (
	  <button
	    onClick={() => onOpenUserManagement()}
	  >
	    User Management
	  </button>
	)}

	<button onClick={() => {
	  setActiveTab("audit");
	  loadAuditLogs();
	}}>
	  Audit Log
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

	{activeTab === "setupChecklist" && (
	  <section className="admin-card">
	    <h2>Draft Setup Checklist</h2>

	    <div
	    className="setup-status"
	    style={{
	      background: setupComplete
	        ? "rgba(34,197,94,0.2)"
	        : "rgba(239,68,68,0.2)",
	      color: setupComplete
	        ? "#22c55e"
	        : "#ef4444",
	      border: `1px solid ${
	        setupComplete ? "#22c55e" : "#ef4444"
	      }`,
	    }}
	  >
	    {setupComplete
	      ? "Setup Complete"
	      : "Setup Incomplete"}
	  </div>

	    <div className="setup-checklist">
	      {setupChecklist.map((item) => (
	        <div
	          key={item.label}
	          className={`setup-check-item ${item.done ? "done" : "missing"}`}
	        >
	          <span>{item.done ? "✅" : "⬜"}</span>
	          <strong>{item.label}</strong>
	        </div>
	      ))}
	    </div>

	    {!setupComplete && (
	      <p className="muted">
	        Complete all checklist items before starting the draft.
	      </p>
	    )}
	  </section>
	)}

{activeTab === "keepers" && (
  <section className="admin-card">
    <h2>Keepers / Coach Picks</h2>

    <label>Player</label>
    <select
      value={keeperPlayerId}
      onChange={(e) => setKeeperPlayerId(e.target.value)}
    >
      <option value="">Select player</option>
      {players.map((p) => (
        <option key={p.id} value={p.id}>
          #{p.random_number} — {p.name} — {p.gender} — {p.primary_position}/{p.secondary_position}
        </option>
      ))}
    </select>

    <label>Team</label>
    <select
      value={keeperTeamId}
      onChange={(e) => setKeeperTeamId(e.target.value)}
    >
      <option value="">Select team</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>

    <label>Round</label>
    <input
      type="number"
      min="1"
      value={keeperRound}
      onChange={(e) => setKeeperRound(e.target.value)}
    />

    <label>Phase</label>
    <select
      value={keeperPhase}
      onChange={(e) => setKeeperPhase(e.target.value)}
    >
      <option value="any">Any</option>
      <option value="female">Female</option>
      <option value="male">Male</option>
    </select>

    <label>
      <input
        type="checkbox"
        checked={keeperIsCoach}
        onChange={(e) => setKeeperIsCoach(e.target.checked)}
      />
      This player is the coach
    </label>

    <button onClick={assignKeeperPlayer}>
      Save Assignment
    </button>

    <h3>Current Assignments</h3>

    {players.filter((p) => p.assigned_team_id).length === 0 ? (
      <p>No pre-draft assignments have been added.</p>
    ) : (
      players
        .filter((p) => p.assigned_team_id)
        .map((p) => {
          const team = teams.find((t) => t.id === p.assigned_team_id);

          return (
            <div key={p.id} className="admin-player-card">
              <span>
                {p.name} → {team?.name || "Unknown Team"} — Round {p.keeper_round || 1}
                {p.is_coach ? " — Coach" : ""}
              </span>

              <button onClick={() => removeKeeperAssignment(p.id)}>
                Remove
              </button>
            </div>
          );
        })
    )}
  </section>
)}

{activeTab === "constraints" && (
  <section className="admin-card">
    <h2>Position Constraints</h2>

    <p>
      Leave min or max blank for no limit. Example: SS min 1, max 3.
    </p>

    <input
      placeholder="Position, example: SS"
      value={constraintPosition}
      onChange={(e) => setConstraintPosition(e.target.value)}
    />

    <input
      type="number"
      placeholder="Minimum"
      value={constraintMin}
      onChange={(e) => setConstraintMin(e.target.value)}
    />

    <input
      type="number"
      placeholder="Maximum"
      value={constraintMax}
      onChange={(e) => setConstraintMax(e.target.value)}
    />

    <button onClick={savePositionConstraint}>
      Save Constraint
    </button>

    <h3>Current Constraints</h3>

    {positionConstraints.length === 0 ? (
      <p>No position constraints have been added. This draft has no position limits.</p>
    ) : (
      positionConstraints.map((c) => (
        <div key={c.id} className="admin-row">
          <span>
            {c.position}: Min {c.min_count ?? "None"} / Max {c.max_count ?? "None"}
          </span>

          <button onClick={() => removePositionConstraint(c.id)}>
            Remove
          </button>
        </div>
      ))
    )}
  </section>
)}

{activeTab === "audit" && (
  <section className="admin-card">
    <h2>Audit Log</h2>

    {auditLogs.length === 0 ? (
      <p>No audit activity yet.</p>
    ) : (
      auditLogs.map((log) => {
        const userName =
          `${log.profiles?.first_name || ""} ${log.profiles?.last_name || ""}`.trim() ||
          log.profiles?.email ||
          "Unknown user";

        return (
          <div key={log.id} className="admin-row">
            <div>
              <strong>{log.action}</strong>
              <br />
              <small>{new Date(log.created_at).toLocaleString()}</small>
              <br />
              <small>By: {userName}</small>
              <pre>{JSON.stringify(log.details, null, 2)}</pre>
            </div>
          </div>
        );
      })
    )}
  </section>
)}

{activeTab === "commissionerAccess" && (
  <section className="admin-card">
    <h2>Commissioner Access</h2>

    <label>Draft</label>
    <select
      value={accessDraftId}
      onChange={(e) => setAccessDraftId(e.target.value)}
    >
      <option value="">Select draft</option>
      {drafts.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>

    <label>Commissioner</label>
    <select
      value={accessUserId}
      onChange={(e) => setAccessUserId(e.target.value)}
    >
      <option value="">Select commissioner</option>
      {profiles
        .filter((p) => p.role === "commissioner")
        .map((p) => (
          <option key={p.id} value={p.id}>
            {`${p.first_name || ""} ${p.last_name || ""}`.trim()} ({p.email})
          </option>
        ))}
    </select>

    <button onClick={grantCommissionerAccess}>
      Grant Access
    </button>

    <h3>Existing Access</h3>

    {accessRows.length === 0 ? (
      <p>No commissioner access has been assigned.</p>
    ) : (
      accessRows.map((row) => {
        const draft = drafts.find((d) => d.id === row.draft_id);
        const user = profiles.find((p) => p.id === row.user_id);

        return (
          <div key={row.id} className="admin-row">
            <span>
              {user?.email || "Unknown commissioner"} → {draft?.name || "Unknown draft"}
            </span>

            <button onClick={() => removeCommissionerAccess(row.id)}>
              Remove
            </button>
          </div>
        );
      })
    )}
  </section>
)}

{activeTab === "settings" && (
  <section className="admin-card">
    <h2>Draft Settings</h2>

    <div className="admin-form-grid">

      <div className="admin-field">
        <label>Draft Name</label>
        <input
          placeholder="Draft Name"
          value={draftName}
          onChange={(e) =>
            setDraftName(e.target.value)
          }
        />
      </div>

      <div className="admin-field">
        <label>Draft Type</label>
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
      </div>

      <div className="admin-field">
        <label>Draft Format</label>
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
      </div>

      <div className="admin-field">
        <label>Pick Time (seconds)</label>
        <input
          type="number"
          value={pickSeconds}
          onChange={(e) =>
            setPickSeconds(e.target.value)
          }
        />
      </div>

      <div className="admin-field">
        <label>Draft Status</label>
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
      </div>

      <hr className="admin-divider" />

      <div className="admin-field">
        <label>Auto Pick Mode</label>

        <select
          value={autoPickMode}
          onChange={(e) =>
            setAutoPickMode(e.target.value)
          }
        >
          <option value="disabled">
            Disabled
          </option>

          <option value="queue_only">
            Queue Only
          </option>

          <option value="queue_random">
            Queue Then Random
          </option>

          <option value="random">
            Random Eligible Player
          </option>
        </select>
      </div>

      <div className="admin-field">
        <label>Salary Cap Type</label>

        <select
          value={salaryCapType}
          onChange={(e) =>
            setSalaryCapType(e.target.value)
          }
        >
          <option value="none">
            No Salary Cap
          </option>

          <option value="salary_cap">
            Salary Cap
          </option>
        </select>
      </div>

      {salaryCapType === "salary_cap" && (
        <div className="admin-field">
          <label>Salary Cap Amount</label>

          <input
            type="number"
            placeholder="Salary cap amount"
            value={salaryCapAmount}
            onChange={(e) =>
              setSalaryCapAmount(e.target.value)
            }
          />
        </div>
      )}

    </div>

    <div className="admin-button-grid">

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
        className="danger"
        onClick={resetDraftProgressOnly}
      >
        Reset Picks & Queues
      </button>

      <button
        className="danger"
        onClick={resetEntireDraft}
      >
        Reset Entire Draft
      </button>

      <button
        className="success"
        onClick={completeDraft}
      >
        Complete Draft
      </button>

    </div>

    <div className="email-settings">

      <div className="admin-field">
        <label>
          Coach Email Message
        </label>

        <textarea
          value={coachEmailMessage}
          onChange={(e) =>
            setCoachEmailMessage(
              e.target.value
            )
          }
          placeholder="Optional message shown at the top of coach roster emails.  Save Settings above after changes.  If you do not want a custom message, clear/delete the contents of this box and Save Settings above."
        />
      </div>

      <div className="admin-field">
        <label>
          Player Email Message
        </label>

        <textarea
          value={playerEmailMessage}
          onChange={(e) =>
            setPlayerEmailMessage(
              e.target.value
            )
          }
          placeholder="Optional message shown at the top of drafted player emails.  Save Settings above after changes.  If you do not want a custom message, clear/delete the contents of this box and Save Settings above."
        />
      </div>

      <div className="admin-field">
        <label>Email Signature</label>

        <textarea
          value={emailSignature}
          onChange={(e) =>
            setEmailSignature(
              e.target.value
            )
          }
          placeholder="Commissioner name, league info, contact details, etc.  Save Settings above after changes.  If you do not want a custom signature, clear/delete the contents of this box and Save Settings above."
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 10,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={sendTestCoachEmail}
          style={{
            background: "#0a65ff",
            border: "1px solid #60a5fa",
            color: "white",
            fontWeight: 900,
          }}
        >
          Send Test Coach Email
        </button>
      
        <button
          onClick={sendTestPlayerEmail}
          style={{
            background: "#2563eb",
            border: "1px solid #60a5fa",
            color: "white",
            fontWeight: 900,
          }}
        >
          Send Test Player Email
        </button>
      </div>

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
                  {`${p.first_name || ""} ${p.last_name || ""}`.trim()} ({p.email})
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

teams.map((t) => {

  const pendingInvite = coachInvites.find(
    (invite) => invite.team_id === t.id
  );

  const assignedCoach = profiles.find(
    (p) => p.id === t.coach_user_id
  );

  return (
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
          {`${p.first_name || ""} ${p.last_name || ""}`.trim()} ({p.email}) — {p.role}
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

	{assignedCoach ? (
	  <div className="assigned-coach">
	    Coach assigned:{" "}
	    {`${assignedCoach.first_name || ""} ${assignedCoach.last_name || ""}`.trim() ||
	      assignedCoach.email}

	    <button onClick={() => updateTeamCoach(t.id, "")}>
	      Remove Coach
	    </button>
	  </div>
	) : pendingInvite ? (
	  <div className="pending-invite">
	    Pending invite: {pendingInvite.email}
	
	    <button onClick={() => clearCoachInvite(pendingInvite.id)}>
	      Clear Invite
	    </button>
	  </div>
	) : (
	  <button onClick={() => sendCoachInvite(t)}>
	    Send Coach Invite
	  </button>
	)}

    </div>
  );
})
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

	  <select
	    value={playerIsCoach}
	    onChange={(e) => setPlayerIsCoach(e.target.value)}
	  >
	    <option value="no">Not Coach</option>
	    <option value="yes">Coach</option>
	  </select>

	    <input
	      type="number"
	      placeholder="Salary Value"
	      value={salaryValue}
	      onChange={(e) => setSalaryValue(e.target.value)}
	    />

            <button onClick={addPlayer}>
              Add Player
            </button>

            {players.length === 0 ? (
	      <p>No players entered.</p>
	    ) : (
	      players.map((p) => (
	        <div key={p.id} className="admin-player-card">
	          
		  <h3 className="player-number-header">
		    #{p.random_number}
		  </h3>

		  <input
	            defaultValue={p.name || ""}
	            placeholder="Name"
	            onBlur={(e) => updatePlayer(p.id, { name: e.target.value })}
	          />

	          <select
	            defaultValue={p.gender || "any"}
	            onChange={(e) => updatePlayer(p.id, { gender: e.target.value })}
	          >
	            <option value="any">Any</option>
	            <option value="female">Female</option>
	            <option value="male">Male</option>
	          </select>
	    
	          <input
	            defaultValue={p.primary_position || ""}
	            placeholder="Primary"
	            onBlur={(e) =>
	              updatePlayer(p.id, {
	                primary_position: e.target.value.toUpperCase(),
	              })
	            }
	          />

	          <input
	            defaultValue={p.secondary_position || ""}
	            placeholder="Secondary"
	            onBlur={(e) =>
	              updatePlayer(p.id, {
	                secondary_position: e.target.value.toUpperCase(),
	              })
	            }
	          />

	          <input
	            defaultValue={p.salary_value || ""}
	            type="number"
	            placeholder="Salary"
	            onBlur={(e) =>
	              updatePlayer(p.id, {
	                salary_value: e.target.value === "" ? null : Number(e.target.value),
	              })
	            }
	          />

	          <select
		    defaultValue={p.is_coach ? "yes" : "no"}
		    onChange={(e) =>
		      updatePlayer(p.id, {
		        is_coach: e.target.value === "yes",
		      })
		    }
		  >
		    <option value="no">Not Coach</option>
		    <option value="yes">Coach</option>
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