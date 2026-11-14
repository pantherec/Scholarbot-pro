// The welcome tour shows on a visitor's first few visits to the app, then stops.
// Its state is a per-browser convenience, kept apart from the student's data
// (sign-out does not clear it), and holds nothing about the student.
export const TOUR_KEY = "meritlaunch-tour";
export const TOUR_MAX_VISITS = 4;

export function readTour(storage) {
  try {
    const v = JSON.parse(storage.getItem(TOUR_KEY) || "{}");
    return { visits: Number.isFinite(v.visits) ? v.visits : 0, never: v.never === true };
  } catch (e) { return { visits: 0, never: false }; }
}

export function writeTour(storage, state) {
  try { storage.setItem(TOUR_KEY, JSON.stringify(state)); } catch (e) { /* private window: the tour just shows again */ }
}

// Called once per browser session when the app opens. Returns whether to show
// the tour, and the state to store.
export function nextTourVisit(state) {
  if (state.never || state.visits >= TOUR_MAX_VISITS) return { show: false, state };
  return { show: true, state: { ...state, visits: state.visits + 1 } };
}

// What each part of the site does, in the order a student meets it. `view` is
// where "Take me there" goes; `art` picks the drawing.
export const TOUR_STEPS = [
  { id: "welcome", art: "welcome", title: "Welcome to MeritLaunch",
    body: "MeritLaunch finds scholarships you appear eligible for and helps you draft letters from your own story. This short tour shows what each part does. It takes about a minute, and you can skip it." },
  { id: "profile", art: "profile", view: "profile", title: "My Profile: tell us about you once",
    body: "Your state, GPA, activities and goals decide which scholarships fit. You can add a resume, a brag sheet, or both; we remove phone numbers, emails and addresses before keeping them." },
  { id: "matches", art: "matches", view: "matches", title: "My Matches: awards you appear eligible for",
    body: "Each match has a fit score that shows how specifically the award is aimed at you. Choose \"Why this score\" to see the points you earned and the ones you did not. Awards that are not open right now stay in their own section for planning." },
  { id: "coach", art: "coach", view: "coach", title: "Score Coach: what would open more awards",
    body: "See how your GPA compares with the awards on our list, and what official sources say to do in your grade. These are estimates from our listings and named sources, never a promise of winning." },
  { id: "find", art: "find", view: "search", title: "Find Scholarships: browse, or bring your own",
    body: "Search every award we track. If yours is not on our list, you can still write for it: upload the application or paste its text on the Write a Letter page." },
  { id: "write", art: "write", view: "generate", title: "Write a Letter: a draft you make yours",
    body: "Say whether the scholarship allows AI help. If it does, you get a draft built only from what you told us, with anything unverified flagged for you to check. If not, you get an outline and questions instead. Practice Answers and Writing Styles shape your drafts." },
  { id: "keep", art: "keep", view: "saved", title: "Saved Letters and My Deadlines",
    body: "Every finished draft is kept in your account, so it is there on any device. Track the awards you are applying to and watch their deadlines in one place." },
  { id: "data", art: "data", view: "profile", title: "Your data stays yours",
    body: "You are the author of every letter. We never sell your information, and you can delete your saved work or your whole account yourself, from My Profile under \"Your data\"." },
];
