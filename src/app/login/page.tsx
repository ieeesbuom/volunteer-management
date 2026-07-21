import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, Building2, ShieldCheck } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { getLoginErrorMessage } from "@/features/access-control/lib/login-error";
import { APP_NAME, ORGANIZATION_NAME } from "@/lib/config";
import { getCurrentUser } from "@/features/access-control/server/current-user";

export const dynamic = "force-dynamic";

function GoogleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const errorMessage = getLoginErrorMessage(params.error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_center,hsl(216,40%,96%),hsl(220,16%,92%))] px-4 py-8">
      <div className="w-full max-w-[940px]">
        <div className="grid overflow-hidden rounded-[16px] border border-border-subtle bg-surface shadow-overlay lg:grid-cols-[1fr_420px]">
          <section className="flex min-h-[420px] flex-col justify-between border-b border-border bg-[linear-gradient(145deg,hsl(216,79%,28%),hsl(216,79%,18%))] p-8 lg:border-b-0 lg:p-10 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex size-11 items-center justify-center rounded-md border border-white/20 bg-white/10 text-white">
                <ShieldCheck className="size-6" aria-hidden="true" />
              </div>
              <p className="mt-8 text-[11px] font-semibold uppercase tracking-widest text-white/70">
                {ORGANIZATION_NAME}
              </p>
              <h1 className="mt-2 max-w-xl text-[28px] font-semibold text-white/90 leading-tight">
                {APP_NAME}
              </h1>
              <p className="mt-4 max-w-sm text-[14px] leading-6 text-white/60">
                Secure access for account verification and Student Branch role
                administration.
              </p>
            </div>
            <div className="mt-10 grid gap-3 text-[13px] text-white/80 relative z-10 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                <Building2 className="mb-2 size-4 text-white/70" aria-hidden="true" />
                Google account sign-in
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                <ShieldCheck className="mb-2 size-4 text-white/70" aria-hidden="true" />
                UoM email verification
              </div>
            </div>
            
            {/* Background decorative elements */}
            <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-primary-mid/10 blur-3xl pointer-events-none" />
          </section>

          <section className="flex items-center p-8 lg:p-10 bg-surface">
            <div className="w-full">
              <div>
                <h2 className="text-[20px] font-semibold text-text-strong">Sign in</h2>
                <p className="mt-1 text-[14px] leading-6 text-text-secondary">
                  Continue with the Google account used for this system.
                </p>
              </div>
              <div className="mt-6 space-y-4">
                {errorMessage ? (
                  <div className="rounded-md border border-danger/25 bg-danger-soft px-3 py-3 text-[13px] text-danger flex items-start gap-3">
                    <AlertCircle className="size-5 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <p className="font-semibold">{errorMessage.title}</p>
                      {errorMessage.details ? (
                        <p className="mt-1 leading-5 opacity-90">{errorMessage.details}</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <Link
                  className={buttonClasses({
                    className: "w-full h-10 hover:border-primary transition-colors",
                    variant: "secondary",
                  })}
                  href="/api/auth/google"
                >
                  <GoogleIcon />
                  Continue with Google
                </Link>
                <p className="text-[12px] leading-5 text-text-muted text-center pt-2">
                  Volunteer actions require a verified{" "}
                  <code className="font-mono bg-neutral-soft px-1.5 py-0.5 rounded text-[11px] text-text-body">@uom.lk</code> email after sign-in.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
