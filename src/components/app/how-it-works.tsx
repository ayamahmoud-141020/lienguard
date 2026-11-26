import { FileSpreadsheet, MailCheck, ScanText, Scale } from "lucide-react";

const steps = [
  { icon: FileSpreadsheet, title: "Upload", text: "Payments spreadsheet plus the waivers and insurance certificates that arrived." },
  { icon: ScanText, title: "AI reads documents", text: "Each field comes with a confidence score and the exact words it was read from." },
  { icon: Scale, title: "Rules decide", text: "Plain, tested code checks every payment and computes the dollars at risk." },
  { icon: MailCheck, title: "Human approves emails", text: "One follow-up per subcontractor. Nothing is sent until a person approves it." },
];

/** The four-step flow. A real sequence, so the steps are numbered. */
export function HowItWorks() {
  return (
    <ol className="grid grid-cols-4 divide-x divide-line rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]">
      {steps.map(({ icon: Icon, title, text }, i) => (
        <li key={title} className="flex gap-3 px-4 py-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[6px] bg-brand-soft text-brand">
            <Icon aria-hidden className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink">
              <span className="num mr-1 text-muted-foreground">{i + 1}.</span>
              {title}
            </p>
            <p className="mt-0.5 text-xs leading-[18px] text-muted-foreground">{text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
