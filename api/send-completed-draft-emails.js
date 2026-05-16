import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { draft, teams, players, profiles } = req.body;

    const sent = [];

    for (const team of teams) {
      const coach = profiles.find((p) => p.id === team.coach_user_id);

      const roster = players.filter(
        (p) =>
          p.drafted_team_id === team.id ||
          p.assigned_team_id === team.id
      );

      if (coach?.email) {
        await resend.emails.send({
          from: "RevealDraft <noreply@revealdraft.com>",
          to: coach.email,
          subject: `${draft.name} - Your Team Roster`,
          html: `
            <div style="font-family:Arial,sans-serif;padding:24px;">
              <h1>${team.name} Roster</h1>
              <p>Your draft roster for <strong>${draft.name}</strong> is below.</p>

              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="background:#071b45;color:white;">
                    <th style="padding:10px;text-align:left;">#</th>
                    <th style="padding:10px;text-align:left;">Player</th>
                    <th style="padding:10px;text-align:left;">Primary</th>
                    <th style="padding:10px;text-align:left;">Secondary</th>
                  </tr>
                </thead>
                <tbody>
                  ${roster
                    .map(
                      (p) => `
                        <tr>
                          <td style="padding:10px;">${p.random_number || ""}</td>
                          <td style="padding:10px;">${p.name || ""}</td>
                          <td style="padding:10px;">${p.primary_position || ""}</td>
                          <td style="padding:10px;">${p.secondary_position || ""}</td>
                        </tr>
                      `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          `,
        });

        sent.push(`coach:${coach.email}`);
      }

      for (const player of roster) {
        if (!player.email) continue;

        await resend.emails.send({
          from: "RevealDraft <noreply@revealdraft.com>",
          to: player.email,
          subject: `${draft.name} - You were drafted to ${team.name}`,
          html: `
            <div style="font-family:Arial,sans-serif;padding:24px;">
              <h1>You were drafted!</h1>

              <p>
                You were drafted to <strong>${team.name}</strong>
                in <strong>${draft.name}</strong>.
              </p>

              <h2>Your Coach</h2>
              <p>
                <strong>${coach?.first_name || ""} ${coach?.last_name || ""}</strong><br/>
                Email: ${coach?.email || "Not provided"}<br/>
                Phone: ${coach?.phone || "Not provided"}<br/>
                Facebook: ${
                  coach?.facebook_url
                    ? `<a href="${coach.facebook_url}">${coach.facebook_url}</a>`
                    : "Not provided"
                }
              </p>
            </div>
          `,
        });

        sent.push(`player:${player.email}`);
      }
    }

    return res.status(200).json({ success: true, sent });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}