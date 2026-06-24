import { InviteAcceptForm } from "@/components/auth/InviteAcceptForm";

interface PageProps {
  params: { token: string };
}

export default async function InvitePage({ params }: PageProps) {
  const res = await fetch(
    `${process.env.NEXTAUTH_URL}/api/invitations/${params.token}`,
    { cache: "no-store" }
  );

  const data = await res.json();

  if (!res.ok || data.error) {
    return (
      <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-card p-8 shadow-2xl text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-text-primary mb-2">Invite Link Issue</h2>
            <p className="text-text-secondary text-sm mb-6">{data.error}</p>
            <p className="text-text-muted text-xs">
              Request a new invite from your admin at Aequora Digital.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-btn bg-brand-primary flex items-center justify-center">
              <WaveIcon />
            </div>
            <span className="text-white text-xl font-semibold">Aequora Digital</span>
          </div>
          <h1 className="text-white text-2xl font-bold">You&apos;re invited!</h1>
          <p className="text-[#64748B] mt-2 text-sm">
            <strong className="text-white">{data.invitation.invitedBy.name}</strong> invited
            you to join the Aequora Digital workspace.
          </p>
        </div>

        <div className="bg-white rounded-card p-8 shadow-2xl">
          <InviteAcceptForm
            token={params.token}
            defaultName={data.invitation.name}
            email={data.invitation.email}
          />
        </div>
      </div>
    </div>
  );
}

function WaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth={2}>
      <path d="M3 12c1.5-3 3-4.5 4.5-4.5S10.5 9 12 9s3-1.5 4.5-1.5S19.5 9 21 12" strokeLinecap="round" />
      <path d="M3 17c1.5-3 3-4.5 4.5-4.5S10.5 14.5 12 14.5s3-1.5 4.5-1.5S19.5 14.5 21 17" strokeLinecap="round" />
    </svg>
  );
}
