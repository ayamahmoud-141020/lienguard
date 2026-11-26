import { BellRing, FileInput, MailCheck, RefreshCw, ScanText, Scale } from "lucide-react";

const steps = [
  { icon: FileInput, title: "Document arrives", text: "Uploaded, or forwarded from the AP inbox when a subcontractor replies." },
  { icon: ScanText, title: "AI reads it", text: "Every field with a confidence score and the exact words it came from." },
  { icon: Scale, title: "Rules re-check", text: "Tested code re-checks the batch, again every day as dates move on." },
  { icon: RefreshCw, title: "Status changes", text: "Payments move between HOLD and SAFE; each change is logged." },
  { icon: BellRing, title: "Notify or remind", text: "The AP inbox is told what cleared; reminders are drafted after 3 days." },
  { icon: MailCheck, title: "Human approves", text: "Nothing goes to a subcontractor until a person approves it." },
];

/** The automated loop (AC-20.2). A real sequence, so the steps are numbered. */
export function HowItWorks() {
  return (
    <ol className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border bg-border shadow-xs">
      {steps.map(({ icon: Icon, title, text }, i) => (
        <li key={title} className="flex gap-3 bg-card px-4 py-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
            <Icon aria-hidden className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
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
