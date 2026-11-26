# ADR-0008: Base the UI on shadcn/ui dashboard-01
Status: accepted · 2026-11-26

**Context:** Aya asked for the UI to be based on a ready, permissively licensed template instead of a custom design, without changing logic, tests, wording, data or passcode behaviour.

**Options checked (licences read from the GitHub API on 2026-11-26):**
- **shadcn/ui** (`shadcn-ui/ui`), **MIT**, actively maintained. The `dashboard-01` block gives a sidebar, header, KPI cards, charts (Recharts) and a data table (TanStack Table).
- **Tremor** (`tremorlabs/tremor`, `tremor-npm`), **Apache-2.0**. Good charts, but it is a second styling system on top of ours, and the npm package's last update was January 2025.
- **shadcn-admin** (`satnaing/shadcn-admin`), **MIT**. Used for layout ideas only; no code copied.

**Decision:** Use shadcn/ui `dashboard-01`, added with the shadcn CLI 4.23.0. The code is copied into `src/components/ui/*` (MIT) and adapted:
- the sidebar, header, KPI cards and table are filled with LienGuard content;
- the demo page, fake data, drag-and-drop, the Tabler icons and `next-themes` were removed;
- `@tanstack/react-table` is pinned to v8, the version the template targets.

**Theme:** shadcn's semantic tokens are mapped to the LienGuard palette in `globals.css`. Primary is deep green, and status colours are used only for status. Our old `muted` text token was retired because it clashed with shadcn's `muted` background; use `muted-foreground` instead.

**Consequences:** Future UI work uses the shadcn components first. Chart data and email highlighting live in pure, tested functions (`src/view/charts.ts`, `src/view/highlight.ts`); the components only draw them. Chart animation is off, which keeps the UI calm and screenshots deterministic.
