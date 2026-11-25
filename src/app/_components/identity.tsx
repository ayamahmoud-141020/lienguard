"use client";

import { useEffect, useState } from "react";
import { getIdentity, setIdentity } from "./client-api";

/** Passcode + reviewer name, kept in sessionStorage for this tab only. */
export function IdentityBar() {
  const [passcode, setPasscode] = useState("");
  const [actor, setActor] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const id = getIdentity();
    setPasscode(id.passcode);
    setActor(id.actor);
    setSaved(Boolean(id.passcode));
  }, []);

  return (
    <form
      className="flex items-center gap-2 text-xs"
      onSubmit={(e) => {
        e.preventDefault();
        setIdentity(passcode, actor);
        setSaved(true);
      }}
    >
      <input aria-label="Your name" placeholder="Your name" value={actor} onChange={(e) => { setActor(e.target.value); setSaved(false); }} className="w-28 rounded border border-slate-300 px-2 py-1" />
      <input aria-label="Demo passcode" type="password" placeholder="Demo passcode" value={passcode} onChange={(e) => { setPasscode(e.target.value); setSaved(false); }} className="w-28 rounded border border-slate-300 px-2 py-1" />
      <button className="rounded bg-slate-800 px-2 py-1 font-medium text-white hover:bg-slate-700" type="submit">
        {saved ? "Saved ✓" : "Save"}
      </button>
    </form>
  );
}
