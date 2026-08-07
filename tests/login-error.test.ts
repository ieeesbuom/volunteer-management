import { describe, expect, it } from "vitest";
import { getLoginErrorMessage } from "../src/features/access-control/lib/login-error";

describe("login error messages", () => {
  it("explains missing Google OAuth client secret errors", () => {
    const error = JSON.stringify({
      code: 400,
      message:
        "Failed to obtain access token. The Google OAuth2 provider returned an error: invalid_request: client_secret is missing.",
      type: "user_oauth2_bad_request",
    });

    expect(getLoginErrorMessage(error)).toEqual({
      details:
        "Add the Google OAuth client secret to Appwrite, or set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env and run npm run setup:appwrite:oauth.",
      title: "Google OAuth client secret is missing",
    });
  });

  it("keeps known app callback errors concise", () => {
    expect(getLoginErrorMessage("callback_failed")?.title).toBe("Login callback failed");
  });

  it("explains unauthorized Appwrite API keys", () => {
    expect(getLoginErrorMessage("api_key_unauthorized")).toEqual({
      details:
        "APPWRITE_API_KEY in .env is revoked or missing required scopes (sessions.write, users.read, rows.read, rows.write). Create a new key in the Appwrite Console, update .env, then restart npm run dev.",
      title: "Appwrite API key is unauthorized",
    });
  });

  it("explains missing OAuth login nonce cookies", () => {
    expect(getLoginErrorMessage("oauth_state_missing")?.title).toBe("Login session expired");
  });
});
