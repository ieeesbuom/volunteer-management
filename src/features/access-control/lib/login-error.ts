type OAuthErrorPayload = {
  code?: number;
  message?: string;
  type?: string;
};

export type LoginErrorMessage = {
  details?: string;
  title: string;
};

const fallbackError: LoginErrorMessage = {
  details: "Try signing in again. If it repeats, check your Google authentication configuration.",
  title: "Login failed",
};

export function getLoginErrorMessage(rawError?: string): LoginErrorMessage | null {
  if (!rawError) {
    return null;
  }

  const parsed = parseOAuthError(rawError);
  const message = parsed?.message ?? rawError;

  if (
    parsed?.type === "user_oauth2_bad_request" &&
    message.toLowerCase().includes("client_secret is missing")
  ) {
    return {
      details:
        "Ensure your Google OAuth client ID and client secret are properly configured in your Supabase Auth provider settings.",
      title: "Google OAuth client secret is missing",
    };
  }

  if (rawError === "oauth_start_failed") {
    return {
      details:
        "Unable to start Google login. Verify that voluntieee.knurdz.org is added to your Supabase redirect URLs and Google OAuth credentials in Supabase Dashboard.",
      title: "Unable to start Google login",
    };
  }

  if (rawError === "oauth_failed") {
    return {
      details:
        "Google login was cancelled or rejected. Check the Google provider credentials and callback URL in Supabase Dashboard.",
      title: "Google login was rejected",
    };
  }

  if (rawError === "api_key_unauthorized") {
    return {
      details:
        "Supabase Service Role Key or API configuration is invalid or missing required permissions. Check SUPABASE_SERVICE_ROLE_KEY in your environment configuration and redeploy.",
      title: "Service authentication key is unauthorized",
    };
  }

  if (rawError === "oauth_state_missing") {
    return {
      details:
        "Start Google login again from this browser. The login CSRF cookie was missing or expired.",
      title: "Login session expired",
    };
  }

  if (rawError === "callback_failed") {
    return {
      details:
        "The Google login returned to the app, but the local session/profile setup failed. Check the server logs for callback details.",
      title: "Login callback failed",
    };
  }

  if (rawError === "missing_callback") {
    return {
      details: "Google returned without the required authentication credentials or tokens.",
      title: "Login callback was incomplete",
    };
  }

  if (rawError === "session_secret_missing") {
    return {
      details:
        "Authentication succeeded but an active session token could not be established. Check the server authentication logs.",
      title: "Login session was incomplete",
    };
  }

  return parsed?.message ? { details: parsed.message, title: "Login failed" } : fallbackError;
}

function parseOAuthError(rawError: string): OAuthErrorPayload | null {
  try {
    const parsed = JSON.parse(rawError) as OAuthErrorPayload;

    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}
