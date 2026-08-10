import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { LoginPromoSlider } from "@/components/login/login-promo-slider";
import { getLoginErrorMessage } from "@/features/access-control/lib/login-error";
import { APP_NAME, ORGANIZATION_NAME } from "@/lib/config";
import { getCurrentUser } from "@/features/access-control/server/current-user";

export const dynamic = "force-dynamic";

function GoogleIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="shrink-0"
    >
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
    <main className="relative min-h-screen bg-surface-raised lg:grid lg:grid-cols-2">
      <a
        href="https://knurdz.org"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute right-6 top-8 z-20 cursor-pointer transition-opacity hover:opacity-80 sm:right-10 lg:right-14 xl:right-16"
        aria-label="Visit Knurdz Community website"
      >
        <Image
          src="/images/powered-by-knurdz-light.png"
          alt="Powered by Knurdz"
          width={1024}
          height={340}
          className="h-9 w-auto max-w-[min(50vw,240px)] object-contain object-right sm:h-10 sm:max-w-[240px]"
        />
      </a>

      <section className="relative flex min-h-screen flex-col lg:border-r lg:border-border-subtle">
        <header className="px-8 pt-10 sm:px-12 lg:px-14 xl:px-16">
          <Image
            src="/images/ieee-sb-uom-logo.png"
            alt={ORGANIZATION_NAME}
            width={1024}
            height={223}
            className="h-10 w-auto max-w-[min(100%,320px)] object-contain object-left sm:h-11"
            priority
          />
        </header>

        <div className="flex flex-1 flex-col justify-center px-8 py-10 sm:px-12 lg:px-14 xl:px-16">
          <div className="mx-auto w-full max-w-[440px]">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">{APP_NAME}</p>
            <h1 className="mt-3 text-[38px] font-bold leading-[1.1] tracking-tight text-text-strong sm:text-[44px]">
              Welcome back!
            </h1>
            <p className="mt-5 text-[15px] leading-7 text-text-muted">
              Sign in with Google to manage events, committees, roles, and volunteer recognition for the IEEE Student
              Branch at University of Moratuwa.
            </p>

            {errorMessage ? (
              <div className="mt-8 flex items-start gap-3 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3.5 text-[13px] text-danger">
                <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">{errorMessage.title}</p>
                  {errorMessage.details ? <p className="mt-1 leading-5 opacity-90">{errorMessage.details}</p> : null}
                </div>
              </div>
            ) : null}

            <div className="mt-10 flex items-center gap-3">
              <span className="h-px flex-1 bg-border-subtle" />
              <span className="shrink-0 text-[13px] font-medium text-text-muted">Continue with</span>
              <span className="h-px flex-1 bg-border-subtle" />
            </div>

            <Link
              href="/api/auth/google"
              className="mt-8 inline-flex h-[3.25rem] w-full cursor-pointer items-center justify-center gap-3 rounded-full bg-text-strong px-6 text-[15px] font-semibold text-white shadow-md transition-[transform,box-shadow,opacity] duration-200 hover:opacity-95 hover:shadow-lg active:scale-[0.99]"
              aria-label="Continue with Google"
            >
              <GoogleIcon size={24} />
              Continue with Google
            </Link>

            <div className="mt-8 rounded-lg border border-primary-mid bg-primary-soft px-4 py-3.5">
              <p className="text-[13px] leading-6 text-text-body">
                Volunteer actions require a verified{" "}
                <code className="rounded-md bg-surface-raised px-1.5 py-0.5 font-mono text-[11px] font-medium text-text-strong">
                  @uom.lk
                </code>{" "}
                email after sign-in.
              </p>
            </div>

            <div className="mt-12 border-t border-border-subtle pt-10 lg:hidden">
              <LoginPromoSlider appName={APP_NAME} />
            </div>
          </div>
        </div>

        <footer className="mt-auto border-t border-border-subtle px-8 py-8 sm:px-12 lg:px-14 xl:px-16">
          <div className="mx-auto flex w-full max-w-[440px] justify-center text-center">
            <a
              href="https://knurdz.org"
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer text-[13px] font-medium leading-snug text-text-muted transition-colors hover:text-primary"
            >
              Designed & Developed by Knurdz Community
            </a>
          </div>
        </footer>
      </section>

      <section className="relative hidden min-h-screen flex-col bg-surface-raised lg:flex">
        <div className="flex flex-1 flex-col items-center justify-center px-10 py-16 xl:px-14">
          <LoginPromoSlider appName={APP_NAME} className="max-w-lg" />
        </div>
      </section>
    </main>
  );
}
