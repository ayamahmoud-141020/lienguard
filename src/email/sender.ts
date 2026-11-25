import { Resend } from "resend";

export type OutgoingEmail = { to: string; subject: string; text: string; idempotencyKey: string };

export interface EmailSender {
  send(m: OutgoingEmail): Promise<{ id: string }>;
}

export class ResendSender implements EmailSender {
  private resend: Resend;
  constructor(
    apiKey: string,
    private from: string,
  ) {
    this.resend = new Resend(apiKey);
  }

  async send(m: OutgoingEmail): Promise<{ id: string }> {
    const { data, error } = await this.resend.emails.send(
      { from: this.from, to: [m.to], subject: m.subject, text: m.text },
      { idempotencyKey: m.idempotencyKey },
    );
    if (error || !data) throw new Error(error?.message ?? "email provider returned no id");
    return { id: data.id };
  }
}

/** Records messages instead of sending them (tests, CI, LIENGUARD_EMAIL=fake). */
export class FakeSender implements EmailSender {
  sent: OutgoingEmail[] = [];
  async send(m: OutgoingEmail): Promise<{ id: string }> {
    this.sent.push(m);
    return { id: `fake-${this.sent.length}` };
  }
}
