import { z } from "zod";
import states from "../../../config/states.json";
import type { StateConfig } from "../types";

const StateConfigSchema = z.object({
  requiresNotary: z.boolean(),
  unconditionalGraceDays: z.number().int().min(0),
});

const parsed = z
  .object({ default: StateConfigSchema })
  .catchall(z.union([StateConfigSchema, z.string()]))
  .parse(states);

/** Per-state settings from config/states.json (demo defaults, user-configurable). */
export function stateConfigFor(state: string): StateConfig {
  const entry = parsed[state.toUpperCase()];
  return typeof entry === "object" && entry !== null ? entry : parsed.default;
}
