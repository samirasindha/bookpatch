import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { Icon } from "../components/Icon";
import { useToast } from "../components/Toasts";
import { api } from "../lib/api";
import { parseGoodreadsExport } from "../lib/goodreads";
import { useGoals, useSaveGoal, useShelfMutations, useShelves } from "../lib/hooks";
import { useTheme, type ThemePref } from "../lib/theme";
import type { GoalPeriod, Me } from "../lib/types";

export function SettingsPage() {
  const { user, signOut } = useAuth();
  return (
    <div className="settings">
      <h1 className="page-title">Settings</h1>
      <ProfileSettings />
      <Appearance />
      <GoalSettings />
      <ShelfSettings />
      <ImportExport />
      <section className="card stack" aria-labelledby="account">
        <h2 id="account" className="section-title">
          Account
        </h2>
        <p className="muted">
          Signed in as {user?.name}
          {user?.isDemo ? ". This is a demo account, and it resets after a day." : ` (${user?.email})`}
        </p>
        <button className="btn btn-outline" style={{ alignSelf: "flex-start" }} onClick={() => void signOut()}>
          <Icon name="logout" size={18} /> Sign out
        </button>
      </section>
    </div>
  );
}

function Appearance() {
  const [pref, setPref] = useTheme();
  const options: { value: ThemePref; label: string }[] = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "Match my device" },
  ];
  return (
    <section className="card stack" aria-labelledby="appearance">
      <h2 id="appearance" className="section-title">
        Appearance
      </h2>
      <div className="segmented" role="radiogroup" aria-labelledby="appearance">
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={pref === o.value} onClick={() => setPref(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function GoalSettings() {
  const goals = useGoals();
  const save = useSaveGoal();
  const toast = useToast();
  const [target, setTarget] = useState("");
  const [period, setPeriod] = useState<GoalPeriod>("year");

  useEffect(() => {
    if (goals.data?.goal) {
      setTarget(String(goals.data.goal.target));
      setPeriod(goals.data.goal.period);
    }
  }, [goals.data?.goal]);

  return (
    <section className="card stack" id="goal" aria-labelledby="goal-h">
      <h2 id="goal-h" className="section-title">
        Reading goal
      </h2>
      <form
        className="row"
        onSubmit={async (e) => {
          e.preventDefault();
          const n = parseInt(target, 10);
          if (!n || n < 1) return toast("Enter how many books");
          await save.mutateAsync({ target: n, period });
          toast(`Goal set: ${n} book${n === 1 ? "" : "s"} a ${period}`);
        }}
      >
        <label className="row" style={{ gap: "0.5rem" }}>
          <span>I want to read</span>
          <input className="input" style={{ width: 80, textAlign: "center" }} inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value.replace(/\D/g, ""))} placeholder="24" />
        </label>
        <span>books a</span>
        <div className="segmented" role="radiogroup" aria-label="Goal period">
          {(["week", "month", "year"] as const).map((p) => (
            <button key={p} type="button" role="radio" aria-checked={period === p} onClick={() => setPeriod(p)}>
              {p}
            </button>
          ))}
        </div>
        <button className="btn btn-dark" type="submit" disabled={save.isPending}>
          Save goal
        </button>
      </form>
    </section>
  );
}

const SHELF_COLORS = ["#d63a24", "#2f5d4a", "#1f3b5c", "#c9a35a", "#6b2b23", "#3d3a6b"];

function ShelfSettings() {
  const shelves = useShelves();
  const { create, update, remove } = useShelfMutations();
  const toast = useToast();
  const [name, setName] = useState("");

  return (
    <section className="card stack" aria-labelledby="shelves-h">
      <div>
        <h2 id="shelves-h" className="section-title">
          Shelves
        </h2>
        <p className="muted small">Group books your way, like "Beach reads" or "Dad's copies". Put a book on a shelf from its details.</p>
      </div>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {shelves.data?.map((s) => (
          <li key={s.id} className="shelf-line">
            <label className="visually-hidden" htmlFor={`color-${s.id}`}>
              Color for {s.name}
            </label>
            <input id={`color-${s.id}`} type="color" className="color-input" value={s.color} onChange={(e) => update.mutate({ id: s.id, color: e.target.value })} />
            <span style={{ flex: 1, fontWeight: 600 }}>{s.name}</span>
            <span className="muted small">
              {s.bookCount} book{s.bookCount === 1 ? "" : "s"}
            </span>
            <button
              className="icon-btn"
              aria-label={`Delete shelf ${s.name}`}
              onClick={async () => {
                await remove.mutateAsync(s.id);
                toast(`Deleted "${s.name}". The books stay in your library.`);
              }}
            >
              <Icon name="close" size={18} />
            </button>
          </li>
        ))}
        {shelves.data?.length === 0 && <li className="muted small">No shelves yet.</li>}
      </ul>
      <form
        className="row"
        style={{ flexWrap: "nowrap" }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          try {
            await create.mutateAsync({ name: name.trim(), color: SHELF_COLORS[(shelves.data?.length ?? 0) % SHELF_COLORS.length] });
            setName("");
          } catch (err) {
            toast((err as Error).message);
          }
        }}
      >
        <label htmlFor="new-shelf" className="visually-hidden">
          New shelf name
        </label>
        <input id="new-shelf" className="input" placeholder="New shelf name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-dark" type="submit">
          <Icon name="plus" size={18} /> Add
        </button>
      </form>
    </section>
  );
}

function ImportExport() {
  const qc = useQueryClient();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function importFile(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) return setStatus("Please choose the .csv file from Goodreads.");
    setBusy(true);
    setStatus("Reading your export…");
    try {
      const rows = parseGoodreadsExport(await file.text());
      setStatus(`Importing ${rows.length} books…`);
      const res = await api<{ imported: number; skipped: number; shelvesCreated: number }>("/library/import/goodreads", { body: { rows } });
      setStatus(
        `Imported ${res.imported} book${res.imported === 1 ? "" : "s"}` +
          (res.skipped ? `, skipped ${res.skipped} already in your library` : "") +
          (res.shelvesCreated ? `, and set up ${res.shelvesCreated} shelves` : "") +
          ".",
      );
      for (const key of ["library", "stats", "shelves", "goals"]) qc.invalidateQueries({ queryKey: [key] });
      toast("Import finished");
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack" aria-labelledby="import-h">
      <h2 id="import-h" className="section-title">
        Import and export
      </h2>
      <p className="muted small">
        Moving from Goodreads? On Goodreads, go to My Books, then Import and export, then Export library. Drop the file here.
        Your ratings, reviews, read dates, owned copies, and shelves come with it.
      </p>
      <div
        className={`dropzone ${over ? "over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void importFile(e.dataTransfer.files[0]);
        }}
      >
        <Icon name="upload" size={28} style={{ margin: "0 auto 0.5rem", color: "var(--text-3)" }} />
        <p style={{ marginBottom: "0.75rem" }}>Drop goodreads_library_export.csv here</p>
        <button className="btn btn-outline btn-sm" onClick={() => fileInput.current?.click()} disabled={busy}>
          Choose file
        </button>
        <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={(e) => void importFile(e.target.files?.[0])} />
      </div>
      {status && (
        <p role="status" className="small">
          {status}
        </p>
      )}
      <div className="settings-row">
        <div>
          <strong>Export your library</strong>
          <p className="muted small">Download everything as a JSON file. Your data is always yours.</p>
        </div>
        <a className="btn btn-outline btn-sm" href="/api/library/export" download>
          <Icon name="download" size={16} /> Export
        </a>
      </div>
    </section>
  );
}

function ProfileSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? "");
  const [handle, setHandle] = useState(user?.handle ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [visibility, setVisibility] = useState<Me["libraryVisibility"]>(user?.libraryVisibility ?? "friends");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await api<{ user: Me }>("/users/me", {
        method: "PATCH",
        body: { name: name.trim(), handle: handle.trim().toLowerCase(), bio: bio.trim() || null, libraryVisibility: visibility },
      });
      qc.setQueryData(["me"], res.user);
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast("Profile saved");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const options: { value: Me["libraryVisibility"]; label: string; hint: string }[] = [
    { value: "public", label: "Anyone", hint: "Anyone signed in can see your shelf" },
    { value: "friends", label: "Friends", hint: "Only people you follow who follow you back" },
    { value: "private", label: "Just me", hint: "Your shelf stays private" },
  ];

  return (
    <section className="card stack" id="profile" aria-labelledby="profile-h">
      <h2 id="profile-h" className="section-title">
        Profile
      </h2>
      <form className="stack" onSubmit={save}>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <label className="field" style={{ flex: "1 1 200px" }}>
            <span className="label">Name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
          </label>
          <label className="field" style={{ flex: "1 1 200px" }}>
            <span className="label">Handle</span>
            <input className="input" value={handle} onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))} maxLength={20} required />
          </label>
        </div>
        <label className="field">
          <span className="label">Bio</span>
          <input className="input" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} placeholder="What do you love to read?" />
        </label>
        <div className="field">
          <span className="label" id="vis-label">
            Who can see your library
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby="vis-label">
            {options.map((o) => (
              <button key={o.value} type="button" role="radio" aria-checked={visibility === o.value} onClick={() => setVisibility(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
          <span className="muted small">{options.find((o) => o.value === visibility)?.hint}</span>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-dark" type="submit" disabled={saving} style={{ alignSelf: "flex-start" }}>
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>
    </section>
  );
}
