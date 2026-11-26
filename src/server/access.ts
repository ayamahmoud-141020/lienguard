import { requirePasscode } from "./guard";

/**
 * Who may do what on the public demo (R-17, AC-14.1).
 * Open: trying the fixed, fictional sample data (recorded readings, no AI cost for reading).
 * Passcode: anything that reads your own files with live AI, changes email text, or sends email.
 */
export const PUBLIC_ACTIONS = ["batch.sample", "drafts.generate", "draft.approve", "draft.skip"] as const;
export const PASSCODE_ACTIONS = ["batch.upload", "document.upload", "document.extract", "batch.evaluate", "draft.edit", "draft.send"] as const;

export type Action = (typeof PUBLIC_ACTIONS)[number] | (typeof PASSCODE_ACTIONS)[number];

/** Maps the draft route's `[action]` segment. Unknown values map to the strictest action. */
export function draftAction(action: string): Action {
  return action === "approve" ? "draft.approve" : action === "skip" ? "draft.skip" : action === "edit" ? "draft.edit" : "draft.send";
}

/** Returns a 401 response, or null when the action may go ahead. */
export function guard(req: Request, action: Action, env: { DEMO_PASSCODE?: string; NODE_ENV?: string } = process.env): Response | null {
  if ((PUBLIC_ACTIONS as readonly string[]).includes(action)) return null;
  return requirePasscode(req, env);
}
