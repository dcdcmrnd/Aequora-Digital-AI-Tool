import { Resend } from "resend";

// Falls back to Resend's shared sandbox sender until a real domain is
// verified in the Resend dashboard and RESEND_FROM_EMAIL is set — the
// sandbox sender can only deliver to the Resend account's own email.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Aequora Digital <onboarding@resend.dev>";

export async function sendPasswordResetEmail({ to, resetUrl }: { to: string; resetUrl: string }): Promise<void> {
  // Instantiated lazily (not at module load) so a missing key only breaks
  // this call, not every route that transitively imports this module.
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "Reset your Aequora Digital password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #0A2540;">Reset your password</h2>
        <p style="color: #1A1D23;">We received a request to reset the password for your Aequora Digital account.</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; background: #0F7B8A; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
            Reset Password
          </a>
        </p>
        <p style="color: #6B7280; font-size: 13px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}
