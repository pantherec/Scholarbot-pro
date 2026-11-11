// Plain-language versions of the errors Supabase Auth returns. The raw messages
// ("Error sending confirmation email", "Invalid login credentials") tell a
// student neither what went wrong nor what to do next.

export const PASSWORD_MIN = 8;

export const PASSWORD_RULES =
  `Use at least ${PASSWORD_MIN} characters. Common passwords and ones that have appeared in known data leaks are not accepted, so pick something you do not use anywhere else. Three or four unrelated words work well.`;

// Returns a message, or "" when the password passes the checks we can run here.
export function passwordProblem(password) {
  if ((password || "").length < PASSWORD_MIN) return `That password is too short. ${PASSWORD_RULES}`;
  return "";
}

// context: "signup" | "signin" | "forgot" | "reset" | "resend"
export function friendlyAuthError(error, context) {
  const msg = (error && error.message) || "";
  const code = (error && error.code) || "";

  if (code === "weak_password" || /weak|easy to guess|password should/i.test(msg)) {
    return `That password is not strong enough. ${PASSWORD_RULES}`;
  }
  if (/error sending .*email/i.test(msg) || (code === "unexpected_failure" && context !== "signin")) {
    return "We could not send your email just now. This is a problem on our side, not with your details. Please try again in a little while, or write to support@meritlaunch.com and we will sort it out.";
  }
  if (code === "over_email_send_rate_limit" || /rate limit|only request this after/i.test(msg)) {
    return "Too many emails were requested in a short time. Please wait a minute, then try again.";
  }
  if (code === "invalid_credentials" || /invalid login credentials/i.test(msg)) {
    return "That email and password do not match an account. Check the email address for typos (for example gmail.com or outlook.com). If you have not created an account yet, choose Sign up below.";
  }
  if (code === "user_already_exists" || /already registered/i.test(msg)) {
    return "An account with that email already exists. Sign in instead, or use Forgot password to set a new one.";
  }
  if (code === "same_password" || /different from the old password/i.test(msg)) {
    return "That is your current password. Please choose a different one.";
  }
  if (/invalid.*email|email.*invalid/i.test(msg)) {
    return "That email address does not look right. Please check it and try again.";
  }
  return msg || "Something went wrong. Please try again.";
}
