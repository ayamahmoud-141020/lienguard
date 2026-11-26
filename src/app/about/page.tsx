import { HowItWorks } from "@/components/app/how-it-works";
import { PageHeader, Panel, PanelHeader } from "@/components/app/layout";
import { RULE_NAMES } from "@/domain/rules";
import { ruleShort } from "@/view/rule-labels";

const exposure: Record<string, string> = {
  R01: "Full amount, if paid",
  R02: "The uncovered difference",
  R03: "Full amount",
  R04: "Full amount",
  R05: "Full amount",
  R06: "Full amount",
  R07: "Full amount",
  R09: "None (hold reason only)",
  R12: "Full amount (fail safe)",
};

const split = [
  ["Reading messy PDFs", "AI", "Layouts, typed or drawn signatures and scans vary too much for templates."],
  ["Parsing money and dates", "Code", "The AI returns the raw text; code turns it into cents and dates, so no arithmetic happens in the model."],
  ["Matching, rules, exposure, decision", "Code", "Money and lien-risk decisions must be predictable, tested and explainable."],
  ["Email wording", "AI", "Friendly, specific prose. The AI only sees placeholders for amounts and dates."],
  ["Numbers in emails", "Code", "Code fills the placeholders, then rejects any amount or date that isn't in the data."],
  ["Sending", "A person", "Every email is approved by a person before it leaves."],
];

export default function AboutPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="How it works"
        description="LienGuard checks each subcontractor payment against the lien waivers and insurance certificates on file, and says whether it is safe to pay or should be held."
      />
      <HowItWorks />
      <div className="grid grid-cols-2 items-start gap-5">
        <Panel>
          <PanelHeader title="Where AI is used, and where it isn't" />
          <table className="w-full text-[13px]">
            <tbody>
              {split.map(([step, who, why]) => (
                <tr key={step} className="border-b border-line align-top last:border-0">
                  <td className="w-44 px-4 py-2.5 font-medium text-ink">{step}</td>
                  <td className="w-20 px-2 py-2.5 text-ink-2">{who}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel>
          <PanelHeader title="Rules in this demo" description="A payment is on hold if any rule fails. Its exposure is the largest single amount at risk, never a sum." />
          <table className="w-full text-[13px]">
            <thead className="border-b border-line bg-subtle">
              <tr>
                <th className="h-8 px-4 text-left text-xs font-medium text-muted-foreground">Rule</th>
                <th className="h-8 px-2 text-left text-xs font-medium text-muted-foreground">Checks</th>
                <th className="h-8 px-4 text-left text-xs font-medium text-muted-foreground">Exposure when it fails</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(RULE_NAMES).map(([id, name]) => (
                <tr key={id} className="border-b border-line last:border-0">
                  <td className="num px-4 py-2 font-semibold text-ink">{id}</td>
                  <td className="px-2 py-2 text-ink-2">
                    {name} <span className="text-muted-foreground">({ruleShort(id).toLowerCase()} if not)</span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{exposure[id]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
      <p className="text-xs text-muted-foreground">Fictional data. LienGuard flags issues for a person to review and is not legal advice; lien rules differ by state.</p>
    </div>
  );
}
