// The account's copy of a student's work (practice answers, documents, voice
// notes, styles). Status values:
//   "unknown" signed in, but the account's copy has not been read yet
//   "pending" a change is waiting to be saved
//   "saved"   the account has the latest
//   "failed"  the account's copy could not be read or written
// Signing out wipes the browser, so anything but "saved" needs a warning.
export function signOutWarning(status) {
  if (status === "saved") return "";
  if (status === "pending") return "Your latest changes are still saving. If you sign out now they may be lost.\n\nSign out anyway?";
  if (status === "failed") return "Your latest changes could not be saved to your account. If you sign out now they will be lost.\n\nSign out anyway?";
  return "We could not confirm that your work is saved to your account. If you sign out now, work done in this browser may be lost.\n\nSign out anyway?";
}

// Try a load a few times before giving up; one dropped request at sign-in
// must not leave the account unsynced for the whole visit.
export async function loadWithRetry(load, tries = 3, waitMs = 800) {
  for (let i = 0; i < tries; i++) {
    if (i) await new Promise((r) => setTimeout(r, waitMs * i));
    const out = await load();
    if (out) return out;
  }
  return null;
}
