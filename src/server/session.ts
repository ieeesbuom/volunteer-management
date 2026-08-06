import "server-only";

import { randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { APPWRITE_SESSION_COOKIE, OAUTH_LOGIN_NONCE_COOKIE } from "@/lib/appwrite/constants";

const cookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export async function getSessionSecret() {
  const cookieStore = await cookies();
  return cookieStore.get(APPWRITE_SESSION_COOKIE)?.value;
}

export async function setSessionSecret(sessionSecret: string, expiresAt?: string) {
  const cookieStore = await cookies();
  cookieStore.set(APPWRITE_SESSION_COOKIE, sessionSecret, {
    ...cookieOptions,
    expires: expiresAt ? new Date(expiresAt) : undefined,
  });
}

export function applySessionSecretCookie(
  response: NextResponse,
  sessionSecret: string,
  expiresAt?: string,
) {
  response.cookies.set(APPWRITE_SESSION_COOKIE, sessionSecret, {
    ...cookieOptions,
    expires: expiresAt ? new Date(expiresAt) : undefined,
  });
}

export async function clearSessionSecret() {
  const cookieStore = await cookies();
  cookieStore.set(APPWRITE_SESSION_COOKIE, "", {
    ...cookieOptions,
    maxAge: 0,
  });
}

export function clearSessionSecretCookie(response: NextResponse) {
  response.cookies.set(APPWRITE_SESSION_COOKIE, "", {
    ...cookieOptions,
    maxAge: 0,
  });
}

export function createOAuthLoginNonce() {
  return randomBytes(32).toString("hex");
}

export function applyOAuthLoginNonceCookie(response: NextResponse, nonce: string) {
  response.cookies.set(OAUTH_LOGIN_NONCE_COOKIE, nonce, {
    ...cookieOptions,
    maxAge: 60 * 10,
  });
}

export function clearOAuthLoginNonceCookie(response: NextResponse) {
  response.cookies.set(OAUTH_LOGIN_NONCE_COOKIE, "", {
    ...cookieOptions,
    maxAge: 0,
  });
}

export async function readOAuthLoginNonce() {
  const cookieStore = await cookies();
  return cookieStore.get(OAUTH_LOGIN_NONCE_COOKIE)?.value ?? null;
}

export async function setOAuthLoginNonce() {
  const cookieStore = await cookies();
  const nonce = createOAuthLoginNonce();
  cookieStore.set(OAUTH_LOGIN_NONCE_COOKIE, nonce, {
    ...cookieOptions,
    maxAge: 60 * 10,
  });

  return nonce;
}

export async function consumeOAuthLoginNonce() {
  const cookieStore = await cookies();
  const nonce = cookieStore.get(OAUTH_LOGIN_NONCE_COOKIE)?.value;
  cookieStore.set(OAUTH_LOGIN_NONCE_COOKIE, "", {
    ...cookieOptions,
    maxAge: 0,
  });

  return nonce ?? null;
}
