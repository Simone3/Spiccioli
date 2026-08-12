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
> **Mockup —** [When the file cannot be written](../mockups/12-storage.html#write-failure)

- **A write that fails is retried, five times in all, and said so on screen.** The causes are almost
  always momentary and not the user's doing — a sync client holding the file open, a volume that has
  gone away for a second, an antivirus pass — so the first answer is to try again rather than to stop
  the session. The attempts are spaced a few seconds apart rather than fired back to back, since a
  lock that is going to clear needs a moment to clear in. While they run, **the save state in the
  sidebar says so instead of *Saved 14:32*** ([§12.2](#122-the-menu-bar-and-which-file-is-open)), and
  a line on the screen the user is on says the file could not be written and is being retried. The
  session carries on: everything is in memory, nothing is lost, and a retry that succeeds clears the
  line and restores the ordinary save state without further ceremony.
- **If all five fail, the application blocks with a message and a *Retry* button.** This is **the one
  thing besides an unreadable file that stops the screens working**
  ([§14](14-empty-and-error-states.md)), and it earns it: every keystroke after a write that will not
  land is work the file does not have, and an application that let the user go on typing over a dead
  file would be lying with every *Saved* it printed. The message states **which file could not be
  written and what the system said**, so a full disk and a permission problem are not the same
  sentence. *Retry* runs the same write; succeeding dismisses it and the session goes on exactly
  where it was, and failing puts the same message back with the new reason. There is no *Continue
  anyway* and no *Save As…* in v1: one file is the model ([§12](#12--storage)), and the way out is to
  free the disk, reconnect the volume or unlock the file — with the message on screen naming which of
  those it is, and the session still in memory waiting for it.
- **External modification detection.** Before writing, the application verifies the file has not
  changed on disk since it last read it. If it has, it **copies the version found on disk into the
  backup folder** and carries on with the session in memory — whose next save overwrites it. The
  session in front of the user is the one being worked on and is never silently discarded; the copy
  means the other version is recoverable if the overwrite turns out to be the wrong call.
- **The user is told, in those terms, and not with a question.** A line appears on the screen they
  are on — *“This file was changed by something else while you had it open. That version has been
  saved to the backup folder as finances-2026-08-08-1432-external, and your work has been kept. That
  copy is one of the 10 backups kept there, so it will be rotated out in time — move it somewhere
  else if you want to keep it.”* — and it stays until dismissed. **The count in that sentence is
  `backupCount` as it currently stands** ([§10](10-settings.md)), not the number ten: the one thing
  the line exists to tell the user is how long the displaced version will last, and a message that
  said ten to someone keeping three would be worse than saying nothing. It is not a modal and it
  is not a choice between two versions: the user has one of them in front of them and has no way to
  judge the other from a dialog, so the application does the safe thing and tells them precisely
  where to find what it displaced. This is what [§1](01-premise-and-constraints.md) means by not
  coordinating two of itself: the folder is allowed to be a synced one, so the situation is ordinary
  rather than exotic, and detecting it and saying so is the whole of the application's answer to it.
- **Rolling timestamped backups live beside the file they belong to, in a folder of their own.** A
  ledger at `…/ledgers/finances.spiccioli` keeps its backups in `…/ledgers/finances-backups/` — the
  file's own name without its extension, plus `-backups`, in the same directory. **The rotation is
  therefore per file**: `backupCount` copies of *this* ledger, ten by default
  ([§10](10-settings.md)), and a second ledger in the same directory keeps its own count in its own
  folder without either one pushing the other out. One folder for all of them would have meant two
  files sharing ten slots, and the one opened less often losing its history to the one opened daily.
- **One backup is taken when a file is closed, and only if something changed during the session.**
  The rule is about the session, not about the gesture that ended it: **however the open file stops
  being the open file, that is a close and it takes the copy.** There are four ways to get there and
  they are all the same event —
  - **Quit**, from the File menu or by any means the platform offers;
  - **closing the window**, which on some platforms is not quitting and is a close all the same;
  - **File › New…**, which leaves this file for a fresh one;
  - **File › Open…** or **Open Recent**, which leaves it for another
    ([§12.2](#122-the-menu-bar-and-which-file-is-open)).

  Listing them is the point: a backup that depended on which of four doors was used would be missing
  precisely when someone worked all afternoon and then opened last year's ledger to compare
  something. A session that only *read* the file writes nothing, whichever door it leaves by — an
  identical copy is not a backup, it is a leak in the rotation, and it would push out the one version
  that was worth keeping.
- **Not per save.** Autosave fires every few seconds while typing; backing up on each would cycle
  the whole rotation away within a minute and leave nothing older than lunchtime.
- **A session that ends in a crash tries to take its backup and may not manage it. That is
  accepted**, and it costs less than it looks: the copy written when the *previous* session closed
  is precisely the state this one started from, so the folder already holds the version to fall back
  to, and the file itself is on disk autosaved to within a few seconds of the crash. What is lost is
  the copy that would have marked where the crashed session got to. Guaranteeing it would mean
  backing up on a timer, which is the per-save rotation this rule exists to avoid.
- **Every copy the application writes there is one of the count.** The backups on close, the version
  displaced by an external modification, and the pre-upgrade copy all go into the same folder and
  the same rotation, and all of them can be pushed out by later ones. There is no protected shelf: a
  second class of backup that never expires would fill the folder with the files nobody chose to
  keep, and `backupCount` would stop meaning what it says. **Both the moments that produce an
  unusual copy say so at the time** — the external-modification line above and the upgrade dialog
  ([§12.1](#121-the-launch-screen)) each state that the copy is part of the rotation and will
  eventually be rotated out, because that is precisely when the user can still decide to move it
  somewhere safe.
- **On launch the application always asks which file to open**, and never reopens the last one on its
  own. [§12.1](#121-the-launch-screen) is that screen.
- **No undo/redo** in v1. This is why every delete confirms.
- **The format must be documented** well enough for an external script to write it — the ten years
  of historical data will be loaded by a one-off migration script, not by the application. It
  carries a **schema version**, and every file is at exactly one of three positions relative to the
  running application: current, older, or not understood.
- **What that format is, and what the file is called, are implementation decisions.** A text format,
  an embedded database, something else: this document requires only that it is one file, that a
  script can write it, and that it carries its schema version. The **extension is not specified
  either** and follows from the format chosen. Where these pages and the mockups need a filename
  they write `finances`, sometimes with an invented extension, and nothing anywhere depends on it —
  the backup folder takes the file's name without whatever extension it turns out to have
  ([§12](#12--storage)), and the window title carries the name alone
  ([§12.2](#122-the-menu-bar-and-which-file-is-open)).
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
  version in one step. `manual` rows are untouched by *that* pass, here as everywhere.
- **A category the new version retires is the upgrade's own problem to solve, and it is solved in the
  upgrade for that version.** A `manual` transaction points at a category id by hand, so re-running
  the rules cannot speak for it: the upgrade that retires a category says what becomes of the rows
  that pointed at it — mapped to whichever category now means what that one meant, or cleared to no
  category so check 2 lists them for the user to place. Which of the two is right depends entirely on
  why the category was retired, so it is decided when it is retired and written into that version's
  upgrade, not fixed here in advance. What this document does fix is that **no upgrade may leave a
  transaction pointing at a category the file no longer holds**: a dangling reference is the one
  outcome not available, since the next open would refuse the file it had just written
  ([§12](#12--storage)). The dialog says which categories are going and what happened to their rows,
  for the same reason it mentions the rules — they are changes to figures the user knows they did not
  make. Without it the invariant of
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

- The application **always** opens here — recent locations, *Open…*, and *New file…*. It never
  reopens the last file on its own.
- ***New file…* asks where to put it, and creates it there and then.** It opens the platform's own
  save dialog, and the file — with the categories of
  [§6.3](06-categories.md#63-category-list) seeded and nothing else in it — is **written at the
  moment the location is chosen**, before any screen is shown. There is no unsaved,
  not-yet-anywhere ledger to lose: the application has one file open at a time and it is a file on
  disk from its first second, which is what makes autosave the only saving mechanism there is and
  *Save As…* a thing that does not need to exist. Cancelling the dialog writes nothing and leaves
  the launch screen up.
- A recent entry whose file has moved or been deleted is shown struck through with the reason, and
  stays in the list until it is dismissed: a file that has vanished from a synced folder is news,
  not something to tidy away.
- The upgrade dialog is the second panel. It names both schema versions, states the backup in the
  sentence rather than a footnote, says that the rules will be re-applied to every automatically
  categorised transaction as part of the upgrade ([§12](#12--storage)), and says plainly what stops
  working afterwards. Cancelling writes nothing at all.
- This is the only *screen* whose errors can keep you out of the rest of the application
  ([§14](14-empty-and-error-states.md)). The one other blocking error belongs to no screen: a file
  that cannot be written after five attempts ([§12](#12--storage)). A file that will not open and a
  file that will not save are the same problem seen from two ends, and they are the only two.

## 12.2 The menu bar, and which file is open

> **Mockup —** [The File menu · switching files](../mockups/12-storage.html#conflicts)

- **The window title is where the current file is named.** It carries the file's name and nothing
  else — *finances — Spiccioli* — and it is the one place that answers “which file am I in?” at a
  glance. The full path is on Settings ([§10](10-settings.md)), a click away, because a path is too
  long to read at a glance and too useful to hide.
- **The sidebar carries the eight screens, the failing-check badge beside *Checks*
  ([§9](09-checks.md)), and the save state** — *Saved 14:32* in the ordinary case, and **the only
  other things it ever says are that a write is being retried and that one has failed**
  ([§12](#12--storage)). There is no third state and no spinner for the ordinary debounced write: a
  save takes no perceptible time, and an indicator that flickered on every keystroke would train the
  user to stop reading the one line that will one day carry bad news. **What it does not carry is the
  file name**, which would put the answer in two places and make the sidebar as wide as the longer of
  them. The window title has that job.
- **Opening another file is a menu action, not a restart.** The launch screen
  ([§12.1](#121-the-launch-screen)) is what the application opens *with*; the File menu is how you
  leave one file for another once it is running. Both reach the same code, so there is nothing you
  can do at launch that you cannot do afterwards.
- **An opened file lands on Portfolio, with no filter set anywhere.** Which screen was last looked
  at, which filters were on it and which row was selected are not remembered — not between files and
  not between sessions. There is nowhere for that state to live ([§10](10-settings.md),
  [§12](#12--storage)), and it is worth nothing: Portfolio is the screen that says what the file
  contains and carries the failing-check banner, which is the thing to read on arriving at a ledger
  whatever was being done in it last time.
- **Two things the menu bar must carry, and everything else is the platform's business.**
  - **A File menu of four actions**: *New…*, which asks where to put a fresh seeded file and writes
    it there ([§12.1](#121-the-launch-screen)); *Open…*, which browses for one; *Open Recent*, which is the same list the launch screen offers; and *Quit*.
    Those four are the same three files and one exit on every platform
    ([§1](01-premise-and-constraints.md)). **All four end the current session and all four take its
    closing backup**, as does closing the window without quitting ([§12](#12--storage)).
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
