import { createContext, useContext } from "react";

// App-wide state and actions, provided by <MeritLaunch> in App.jsx. Pages read
// what they need with useApp() instead of living inside one giant component.
export const AppContext = createContext(null);
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp() must be used inside <AppContext.Provider>");
  return ctx;
}
