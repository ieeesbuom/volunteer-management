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
        "Ensure your Google OAuth client ID and client secret are properly configured in your Supabase Auth provider settings.",
      title: "Google OAuth client secret is missing",
    });
  });

  it("keeps known app callback errors concise", () => {
    expect(getLoginErrorMessage("callback_failed")?.title).toBe("Login callback failed");
  });

  it("explains unauthorized service API keys", () => {
    expect(getLoginErrorMessage("api_key_unauthorized")).toEqual({
      details:
        "Supabase Service Role Key or API configuration is invalid or missing required permissions. Check SUPABASE_SERVICE_ROLE_KEY in your environment configuration and redeploy.",
      title: "Service authentication key is unauthorized",
    });
  });

  it("explains missing OAuth login nonce cookies", () => {
    expect(getLoginErrorMessage("oauth_state_missing")?.title).toBe("Login session expired");
  });

  it("explains oauth start failures with reason", () => {
    expect(
      getLoginErrorMessage("oauth_start_failed", "Invalid server environment variables: ADMIN_EMAIL is Required"),
    ).toEqual({
      details:
        "Unable to start Google login: Invalid server environment variables: ADMIN_EMAIL is Required. Check your server and provider configuration.",
      title: "Unable to start Google login",
    });
  });

  it("explains oauth start failures without reason", () => {
    expect(getLoginErrorMessage("oauth_start_failed")).toEqual({
      details:
        "Unable to start Google login. Check your server logs and Google authentication configuration in Supabase Dashboard.",
      title: "Unable to start Google login",
    });
  });
});
