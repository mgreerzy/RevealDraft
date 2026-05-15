import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { to, inviteUrl, draftName, teamName } = req.body;

    const response = await resend.emails.send({
      from: "RevealDraft <noreply@revealdraft.com>",
      to,
      subject: `You're invited to coach ${teamName}`,
      html: `
        <div style="font-family:Arial,sans-serif;padding:24px;">
          <h1>RevealDraft Coach Invite</h1>
          <p>You have been invited to coach <strong>${teamName}</strong> in <strong>${draftName}</strong>.</p>
          <p>
            <a href="${inviteUrl}" style="background:#0a65ff;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold;">
              Accept Invite
            </a>
          </p>
        </div>
      `,
    });

    return res.status(200).json(response);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}