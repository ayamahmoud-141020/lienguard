"use client";

import { Lock, LockOpen } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { getIdentity, onIdentityChange, PASSCODE_NOTE, setIdentity } from "@/app/_components/client-api";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/primitives";

/** True once a passcode is entered in this tab. The server still checks it on every protected action. */
export function useUnlocked(): boolean {
  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => {
    const sync = () => setUnlocked(Boolean(getIdentity().passcode));
    sync();
    return onIdentityChange(sync);
  }, []);
  return unlocked;
}

/** Small note under actions that need the passcode, shown only while locked. */
export function PasscodeNote({ className }: { className?: string }) {
  const unlocked = useUnlocked();
  if (unlocked) return null;
  return (
    <p className={cn("flex items-center gap-1 text-xs text-muted", className)}>
      <Lock aria-hidden className="size-3" />
      {PASSCODE_NOTE}
    </p>
  );
}

const field = "mt-1 block h-9 w-full rounded-[6px] border border-line-strong bg-surface px-2.5 text-sm text-ink placeholder:text-muted";

export function DemoAccess({ trigger }: { trigger?: ReactNode }) {
  const unlocked = useUnlocked();
  const [passcode, setPasscode] = useState("");
  const [actor, setActor] = useState("");
  useEffect(() => {
    const id = getIdentity();
    setPasscode(id.passcode);
    setActor(id.actor);
  }, []);

  const [open, setOpen] = useState(false);
  const save = () => {
    setIdentity(passcode.trim(), actor.trim());
    toast.success(passcode.trim() ? "Demo access unlocked for this tab" : "Demo access locked");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <button
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-[6px] border px-2.5 text-[13px] font-medium transition-colors",
              unlocked ? "border-[#bcd9cc] bg-brand-soft text-brand hover:bg-[#d9ebe3]" : "border-line-strong bg-surface text-ink-2 hover:bg-subtle",
            )}
          >
            {unlocked ? <LockOpen aria-hidden className="size-4" /> : <Lock aria-hidden className="size-4" />}
            {unlocked ? "Demo access unlocked" : "Demo access"}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="flex items-center gap-2">
            {unlocked ? <LockOpen aria-hidden className="size-4 text-brand" /> : <Lock aria-hidden className="size-4 text-muted" />}
            <h2 className="text-sm font-semibold">{unlocked ? "Unlocked" : "Locked"}</h2>
          </div>
          <p className="mt-1 text-[13px] text-muted">
            Anyone can try the sample data. The passcode is only needed to upload your own files, edit drafts and send emails.
          </p>
          <label className="mt-3 block text-[13px] font-medium text-ink-2">
            Your name
            <input className={field} value={actor} onChange={(e) => setActor(e.target.value)} placeholder="Shown in the audit log" autoComplete="name" />
          </label>
          <label className="mt-3 block text-[13px] font-medium text-ink-2">
            Demo passcode
            <input className={field} type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="Ask Aya" autoComplete="off" />
          </label>
          <div className="mt-4 flex items-center justify-between gap-2">
            {unlocked ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPasscode("");
                  setIdentity("", actor.trim());
                  toast("Demo access locked");
                }}
              >
                Lock again
              </Button>
            ) : (
              <span className="text-xs text-muted">Kept for this tab only.</span>
            )}
            <Button type="submit" variant="primary" size="sm">
              Save
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
