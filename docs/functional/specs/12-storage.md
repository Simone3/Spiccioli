# §12 — Storage

*[Index](../README.md) · [mockups for this section](../mockups/12-storage.html)*

---

- **One file** holding all the data: institutions, accounts, securities, prices, transactions,
  trades, contracts, contract years, payslips, categories, rules. All eleven stored entities of
  [§2](02-domain-model.md) and nothing else — the file is the ledger, whole and portable.
- **Preferences are not in it.** They belong to the installation, not to the ledger, and live in the
  platform's own application-data location alongside the list of recently opened files
  ([§10](10-settings.md)). A format you like reading is a fact about you; carrying it inside the
  file would mean two files disagreeing about how to print a date, and opening one of them silently
  changing the other's appearance.
- **The file lives wherever the user puts it** — a plain local folder, a cloud-synced folder, or an
  encrypted vault inside one. The application makes no assumption about the location and requires
  nothing of it.
- **Autosave**, debounced, written **atomically** — write to a temporary file in the same directory,
  then rename — so an interrupted write cannot truncate it.
- **External modification detection.** Before writing, the application verifies the file has not
  changed on disk since it last read it. If it has, it **copies the version found on disk into the
  backup folder** and carries on with the session in memory — whose next save overwrites it. The
  session in front of the user is the one being worked on and is never silently discarded; the copy
  means the other version is recoverable if the overwrite turns out to be the wrong call.
- **The user is told, in those terms, and not with a question.** A line appears on the screen they
  are on — *“This file was changed by something else while you had it open. That version has been
  saved to the backup folder as finances-2026-08-08-1432-external.spiccioli, and your work has been
  kept. That copy is one of the ten backups kept there, so it will be rotated out in time — move it
  somewhere else if you want to keep it.”* — and it stays until dismissed. It is not a modal and it
  is not a choice between two versions: the user has one of them in front of them and has no way to
  judge the other from a dialog, so the application does the safe thing and tells them precisely
  where to find what it displaced. This is what [§1](01-premise-and-constraints.md) means by not
  coordinating two of itself: the folder is allowed to be a synced one, so the situation is ordinary
  rather than exotic, and detecting it and saying so is the whole of the application's answer to it.
- **Ten rolling timestamped backups** in a folder beside the data file, count configurable. One is
  taken **when the application quits after a session in which anything changed**, and one **when a
  file is opened** — not per save. Autosave fires every few seconds while typing; backing up on each
  would cycle all ten away within a minute and leave nothing older than lunchtime.
- **Every copy the application writes there is one of the ten.** The routine backups, the version
  displaced by an external modification, and the pre-upgrade copy all go into the same folder and
  the same rotation, and all of them can be pushed out by later ones. There is no protected shelf: a
  second class of backup that never expires would fill the folder with the files nobody chose to
  keep, and `backupCount` would stop meaning what it says. **Both the moments that produce an
  unusual copy say so at the time** — the external-modification line above and the upgrade dialog
  ([§12.1](#121-the-launch-screen)) each state that the copy is part of the rotation and will
  eventually be rotated out, because that is precisely when the user can still decide to move it
  somewhere safe.
- **The backup on open is skipped when the file is byte-for-byte the newest backup already held.**
  Otherwise opening the application ten times on a quiet week would fill the folder with ten
  identical copies and push out the one version that was actually worth keeping. Backups exist to
  hold *different* states, so an identical one is not a backup, it is a leak in the rotation.
- Between them the two moments cover the case the quit-only rule missed: a session that ends in a
  crash, or one that ruins the file and is closed in a hurry, still has the state it started from
  sitting in the folder.
- **On launch the application always asks which file to open**, offering the recently opened
  locations, a browse option, and **New file…** — which writes a fresh file with the categories of
  [§6.3](06-categories.md#63-category-list) seeded and nothing else. It never reopens the last file
  automatically.
- **No undo/redo** in v1. This is why every delete confirms.
- **The format must be documented** well enough for an external script to write it — the ten years
  of historical data will be loaded by a one-off migration script, not by the application. It
  carries a **schema version**, and every file is at exactly one of three positions relative to the
  running application: current, older, or not understood.
- **An older file is upgraded once, with the user's consent.** Opening one shows a screen that says
  which version wrote it and which version it will become, and states that a copy of the file as it
  stands now is written to the backup folder first. Confirm and the upgrade runs and the file opens;
  cancel and nothing is written and the launch screen returns. It is never silent and never
  automatic, because it is the one operation that makes a file unreadable by the version the user
  was running yesterday.
- **An upgrade re-applies the rule list as part of itself.** The category list is seeded by the
  application and changing it is a change to the application
  ([§6.3](06-categories.md#63-category-list)), so a new version is exactly the thing that can add a
  category, retire one or move a role — and any of those leaves the stored category of an
  `automatic` transaction disagreeing with what the rule list now produces. The upgrade therefore
  runs the same pass the Rules tab runs ([§6.2](06-categories.md#62-rules)) over every transaction
  whose `categorySource = automatic`, and writes the categories, the rules and the new schema
  version in one step. `manual` rows are untouched, here as everywhere. Without it the invariant of
  [§2](02-domain-model.md) would hold for every file except the ones that had just been upgraded,
  and it is that invariant which lets every total read the stored category instead of re-deriving
  it. It needs no separate consent — it is part of the upgrade the user has already confirmed — but
  the dialog says it will happen, since it is a change to figures the user knows they did not make.
- **Anything not understood is not opened at all.** A schema version later than the application's,
  or a file at a known version carrying something unrecognised — an unknown category, role or field
  — is refused with a statement of what was not understood, and the launch screen stays up with the
  other files still openable. **There is no read-only mode**: a file is either open and fully
  editable or not open. Half-open is a state that would have to be explained on every screen, and
  the alternative it exists to avoid — writing back a file with the unknown parts quietly removed —
  is already prevented by refusing. Files outlive versions, and the way to honour that is to leave
  alone the ones you cannot fully read.

> Atomic writes and external-modification detection are not paranoia about a specific setup: they
> are what makes the file safe in a folder that something else — a sync client, a backup agent, an
> encrypted volume — may also be touching. They cost little and they are the reason the application
> does not care where the file is.

## 12.1 The launch screen

> **Mockup —** [The launch screen](../mockups/12-storage.html#launch)

- The application **always** opens here — recent locations, *Open…*, and *New file…*, which writes a
  fresh file with the categories of [§6.3](06-categories.md#63-category-list) seeded and nothing
  else. It never reopens the last file on its own.
- A recent entry whose file has moved or been deleted is shown struck through with the reason, and
  stays in the list until it is dismissed: a file that has vanished from a synced folder is news,
  not something to tidy away.
- The upgrade dialog is the second panel. It names both schema versions, states the backup in the
  sentence rather than a footnote, says that the rules will be re-applied to every automatically
  categorised transaction as part of the upgrade ([§12](#12--storage)), and says plainly what stops
  working afterwards. Cancelling writes nothing at all.
- This is the **only** screen in the application where an error can prevent you from getting to the
  rest of it ([§14](14-empty-and-error-states.md)).

## 12.2 The menu bar, and which file is open

> **Mockup —** [The File menu · switching files](../mockups/12-storage.html#conflicts)

- **The window title is where the current file is named.** It carries the file's name and nothing
  else — *finances — Spiccioli* — and it is the one place that answers “which file am I in?” at a
  glance. The full path is on Settings ([§10](10-settings.md)), a click away, because a path is too
  long to read at a glance and too useful to hide.
- **The sidebar carries the eight screens, the failing-check badge beside *Checks*
  ([§9](09-checks.md)), and the save state** — *Saved 14:32*. **What it does not carry is the file
  name.** It used to, which put the answer in two places and meant the sidebar had to be wide enough
  for the longer of them. The window title already had the job.
- **Opening another file is a menu action, not a restart.** The launch screen
  ([§12.1](#121-the-launch-screen)) is what the application opens *with*; the File menu is how you
  leave one file for another once it is running. Both reach the same code, so there is nothing you
  can do at launch that you cannot do afterwards.
- **Two things the menu bar must carry, and everything else is the platform's business.**
  - **A File menu of four actions**: *New…*, which writes a fresh seeded file; *Open…*, which
    browses for one; *Open Recent*, which is the same list the launch screen offers; and *Quit*,
    which takes the closing backup. Those four are the same three files and one exit on every
    platform ([§1](01-premise-and-constraints.md)).
  - **An About item naming the application and its version.** It is the only place a version number
    appears, and it is the thing to read before saying which version wrote a file
    ([§12.1](#121-the-launch-screen)) or reporting that something went wrong.
- **Everything else is left to the implementation and to the platform's conventions** — where
  *About* and *Quit* sit, whether there is a Window or a Help menu, the standard edit-field items a
  toolkit puts in by default. Specifying them would be specifying the operating system. What is
  *not* left open is that there is no application-specific menu beyond File: there is no Edit menu,
  because there is no undo, and no View menu, because there is nothing to configure about the view —
  everything the application does, it does on a screen.

---

[← §11 Calculations](11-calculations.md) · [§13 Validation →](13-validation.md)
