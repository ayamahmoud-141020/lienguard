"use client";

// Charts use the shadcn/ui dashboard-01 chart components (Recharts, MIT).
// "Holds by reason" is one neutral series (identity = rule, shown as labels). "Safe vs Hold" is status, so it uses status colours with text labels.
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

type Reason = { ruleId: string; label: string; payments: number };

const reasonConfig = { payments: { label: "Payments on hold", color: "var(--chart-1)" } } satisfies ChartConfig;

export function HoldsByReasonChart({ data }: { data: Reason[] }) {
  const rows = data.map((d) => ({ ...d, name: `${d.ruleId} ${d.label}` }));
  return (
    <ChartContainer config={reasonConfig} className="aspect-auto w-full" style={{ height: Math.max(160, rows.length * 30 + 16) }}>
      <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 28, top: 4, bottom: 4 }} barCategoryGap={6}>
        <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={172} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
        <XAxis type="number" hide allowDecimals={false} />
        <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent hideLabel={false} />} />
        <Bar isAnimationActive={false} dataKey="payments" fill="var(--color-payments)" radius={[0, 4, 4, 0]} maxBarSize={18}>
          <LabelList dataKey="payments" position="right" className="fill-foreground" fontSize={12} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

// Keys must not be "safe"/"hold": the chart defines --color-<key>, which would point at itself.
const splitConfig = {
  safeShare: { label: "Safe", color: "#12723f" },
  holdShare: { label: "Hold", color: "#b4231b" },
} satisfies ChartConfig;

export function SafeVsHoldChart({ safe, hold }: { safe: number; hold: number }) {
  const data = [
    { key: "holdShare", label: "Hold", value: hold, fill: "#b4231b" },
    { key: "safeShare", label: "Safe", value: safe, fill: "#12723f" },
  ];
  const total = safe + hold;
  return (
    <div className="flex items-center gap-6">
      <ChartContainer config={splitConfig} className="aspect-square h-[168px] shrink-0">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey="label" hideLabel />} />
          <Pie isAnimationActive={false} data={data} dataKey="value" nameKey="label" innerRadius={52} outerRadius={78} strokeWidth={2} stroke="var(--card)">
            {data.map((d) => (
              <Cell key={d.key} fill={d.fill} />
            ))}
          </Pie>
          <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-2xl font-semibold">
            {total}
          </text>
          <text x="50%" y="60%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-xs">
            payments
          </text>
        </PieChart>
      </ChartContainer>
      <ul className="space-y-3 text-sm">
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-2.5 rounded-sm bg-hold" />
          <span className="text-foreground">Hold</span>
          <span className="num ml-2 font-semibold">{hold}</span>
          <span className="num text-muted-foreground">({total ? Math.round((hold / total) * 100) : 0}%)</span>
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-2.5 rounded-sm bg-safe" />
          <span className="text-foreground">Safe</span>
          <span className="num ml-2 font-semibold">{safe}</span>
          <span className="num text-muted-foreground">({total ? Math.round((safe / total) * 100) : 0}%)</span>
        </li>
      </ul>
    </div>
  );
}
