import type { Cents } from "./money";
import type { IsoDate } from "./dates";

export type Project = { code: string; name: string; state: string; ownerName: string };
export type Subcontractor = { code: string; name: string; email: string; contactName: string };
export type Payment = {
  id: string;
  projectCode: string;
  subCode: string;
  invoiceNo: string;
  amountCents: Cents;
  periodEnd: IsoDate;
  paidDate: IsoDate | null;
  isFinal: boolean;
};

export type WaiverType = "conditional" | "unconditional";
export type WaiverScope = "progress" | "final";

/** A waiver after extraction + parsing (values trusted only if !needsReview). */
export type Waiver = {
  documentId: string;
  fileName: string;
  claimantName: string;
  customerName: string | null;
  projectName: string;
  type: WaiverType | null;
  scope: WaiverScope | null;
  amountCents: Cents | null;
  throughDate: IsoDate | null;
  signed: boolean | null;
  notarized: boolean | null;
  needsReview: boolean;
  reviewReasons: string[];
};

export type Coi = {
  documentId: string;
  fileName: string;
  insuredName: string;
  glExpiry: IsoDate | null;
  needsReview: boolean;
  reviewReasons: string[];
};

export type RuleId = "R01" | "R02" | "R03" | "R04" | "R05" | "R06" | "R07" | "R09" | "R12";

export type Finding = {
  paymentId: string;
  ruleId: RuleId;
  severity: "hold" | "warn";
  message: string;
  exposedCents: Cents;
};

export type Decision = "SAFE" | "HOLD";

export type StateConfig = { requiresNotary: boolean; unconditionalGraceDays: number };
