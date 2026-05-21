import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function UserManagement({ profile, onBack }) {
  const [profiles, setProfiles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [commissionerDrafts, setCommissionerDrafts] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("active");
  const [draftFilter, setDraftFilter] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 25;

  useEffect(() => {
    loadProfiles();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter, activeFilter, draftFilter]);

  async function loadProfiles() {
    const [profilesResult, teamsResult, commissionersResult] =
      await Promise.all([
        supabase.from("profiles").select("*").order("email"),
        supabase.from("teams").select(`
          id,
          name,
          draft_id,
          coach_user_id,
          drafts(name)
        `),
        supabase.from("draft_commissioners").select(`
          user_id,
          draft_id,
          drafts(name)
        `),
      ]);

    if (profilesResult.error) return alert(profilesResult.error.message);
    if (teamsResult.error) return alert(teamsResult.error.message);
    if (commissionersResult.error) return alert(commissionersResult.error.message);

    setProfiles(profilesResult.data || []);
    setTeams(teamsResult.data || []);
    setCommissionerDrafts(commissionersResult.data || []);
  }

  async function updateRole(id, role) {
    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", id);

    if (error) return alert(error.message);
    await loadProfiles();
  }

  async function updateProfileField(id, field, value) {
    const { error } = await supabase
      .from("profiles")
      .update({ [field]: value })
      .eq("id", id);

    if (error) return alert(error.message);
  }

  async function toggleUserActive(id, active) {
    const { error } = await supabase
      .from("profiles")
      .update({ active })
      .eq("id", id);

    if (error) return alert(error.message);
    await loadProfiles();
  }

  async function resetUserPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });

    if (error) return alert(error.message);
    alert(`Password reset email sent to ${email}`);
  }

  const draftOptions = Array.from(
    new Map(
      [
        ...teams.map((t) => ({
          id: t.draft_id,
          name: t.drafts?.name || "Unknown Draft",
        })),
        ...commissionerDrafts.map((d) => ({
          id: d.draft_id,
          name: d.drafts?.name || "Unknown Draft",
        })),
      ]
        .filter((d) => d.id)
        .map((d) => [d.id, d])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const filteredProfiles = profiles.filter((p) => {
    const name = `${p.first_name || ""} ${p.last_name || ""}`.toLowerCase();
    const email = (p.email || "").toLowerCase();
    const search = searchTerm.toLowerCase();

    const matchesSearch = name.includes(search) || email.includes(search);
    const matchesRole = roleFilter === "all" || p.role === roleFilter;
    const matchesActive =
      activeFilter === "all" ||
      (activeFilter === "active" && p.active !== false) ||
      (activeFilter === "inactive" && p.active === false);

    const userTeamDraftIds = teams
      .filter((t) => t.coach_user_id === p.id)
      .map((t) => t.draft_id);

    const userCommissionerDraftIds = commissionerDrafts
      .filter((d) => d.user_id === p.id)
      .map((d) => d.draft_id);

    const matchesDraft =
      draftFilter === "all" ||
      userTeamDraftIds.includes(draftFilter) ||
      userCommissionerDraftIds.includes(draftFilter);

    return matchesSearch && matchesRole && matchesActive && matchesDraft;
  });

  const userStats = {
    total: profiles.length,
    active: profiles.filter((p) => p.active !== false).length,
    inactive: profiles.filter((p) => p.active === false).length,
    admins: profiles.filter((p) => p.role === "admin").length,
    commissioners: profiles.filter((p) => p.role === "commissioner").length,
    coaches: profiles.filter((p) => p.role === "coach").length,
    viewers: profiles.filter((p) => p.role === "viewer").length,
  };

  const totalPages = Math.ceil(filteredProfiles.length / usersPerPage);
  const startIndex = (currentPage - 1) * usersPerPage;
  const paginatedProfiles = filteredProfiles.slice(
    startIndex,
    startIndex + usersPerPage
  );

  return (
    <div className="admin-page">
      <aside className="admin-sidebar">
        <h2>User Management</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
          <button onClick={() => onBack("admin")}>
            Back to Admin Dashboard
          </button>

          <button onClick={() => onBack("draft")}>
            Back to Draft Room
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <section className="admin-card">
          <h2>Users</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 10,
              marginBottom: 18,
            }}
          >
            {Object.entries(userStats).map(([label, value]) => (
              <div
                key={label}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {label.toUpperCase()}
                </div>
                <strong style={{ fontSize: 22 }}>{value}</strong>
              </div>
            ))}
          </div>

          <div
            className="admin-row"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <input
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="commissioner">Commissioner</option>
              <option value="coach">Coach</option>
              <option value="viewer">Viewer</option>
            </select>

            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
            >
              <option value="active">Active Users</option>
              <option value="inactive">Inactive Users</option>
              <option value="all">All Users</option>
            </select>

            <select
              value={draftFilter}
              onChange={(e) => setDraftFilter(e.target.value)}
            >
              <option value="all">All Drafts</option>
              {draftOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <hr
            style={{
              marginTop: 10,
              marginBottom: 20,
              borderColor: "rgba(255,255,255,0.12)",
            }}
          />

          {filteredProfiles.length === 0 ? (
            <p>No users found.</p>
          ) : (
            paginatedProfiles.map((p) => {
              const assignedTeams = teams.filter((t) => t.coach_user_id === p.id);
              const commissionerAccess = commissionerDrafts.filter(
                (d) => d.user_id === p.id
              );

              return (
                <div
                  key={p.id}
                  className="admin-row"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    padding: 20,
                    marginTop: 20,
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div>
                    <strong>
                      {`${p.first_name || ""} ${p.last_name || ""}`.trim() ||
                        "Unnamed User"}
                    </strong>{" "}
                    ({p.email})
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {assignedTeams.length === 0 ? (
                      <div>No team assignments</div>
                    ) : (
                      assignedTeams.map((t) => (
                        <div key={t.id}>
                          Team: {t.name} — Draft: {t.drafts?.name || "Unknown"}
                        </div>
                      ))
                    )}

                    {p.role === "commissioner" && (
                      <>
                        {commissionerAccess.length === 0 ? (
                          <div>No commissioner draft access</div>
                        ) : (
                          commissionerAccess.map((d) => (
                            <div key={d.draft_id}>
                              Commissioner access: {d.drafts?.name || "Unknown"}
                            </div>
                          ))
                        )}
                      </>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <select
                      value={p.role || "coach"}
                      onChange={(e) => updateRole(p.id, e.target.value)}
                    >
                      <option value="admin">admin</option>
                      <option value="commissioner">commissioner</option>
                      <option value="coach">coach</option>
                      <option value="viewer">viewer</option>
                    </select>

                    <input
                      placeholder="Phone Number"
                      defaultValue={p.phone || ""}
                      onBlur={(e) =>
                        updateProfileField(p.id, "phone", e.target.value)
                      }
                    />

                    <input
                      placeholder="Facebook Profile URL"
                      defaultValue={p.facebook_url || ""}
                      onBlur={(e) =>
                        updateProfileField(p.id, "facebook_url", e.target.value)
                      }
                    />

                    {profile?.role === "admin" && (
                      <button onClick={() => resetUserPassword(p.email)}>
                        Reset Password
                      </button>
                    )}

                    <button
                      onClick={() => toggleUserActive(p.id, p.active === false)}
                    >
                      {p.active === false ? "Reactivate" : "Deactivate"}
                    </button>
                  </div>
                </div>
              );
            })
          )}

          <div
            className="admin-row"
            style={{
              justifyContent: "space-between",
              marginTop: 24,
              gap: 12,
            }}
          >
            <span>
              Showing {filteredProfiles.length === 0 ? 0 : startIndex + 1}-
              {Math.min(startIndex + usersPerPage, filteredProfiles.length)} of{" "}
              {filteredProfiles.length} users
            </span>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                Previous
              </button>

              <span>
                Page {currentPage} / {totalPages || 1}
              </span>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}