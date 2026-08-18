# §1 — Architecture

*[Index](README.md)*

---

## 1.1 Two processes

Spiccioli is an Electron application, so it runs as two processes with different powers, and every feature has to be placed in one of them.

- **The main process** is Node. It is the only side that can touch the filesystem, open dialogs, read the application's own version or write the operational log. It owns the window and decides what that window is allowed to load. Its entry point is `src/main/Main.ts`.
- **The renderer** is a Chromium page running React. It has no Node access at all: `contextIsolation` is on and `nodeIntegration` is off. Its entry point is `src/index.tsx`.

Between them sits **the preload script**, `src/main/preload/Preload.ts`. It runs in the renderer's context with access to Electron's IPC, and it publishes a small, explicit object on `window` for the page to call. Nothing else crosses: the renderer cannot reach a module the preload did not expose, and the preload exposes functions rather than handles.

The two processes are bundled separately and by different tools, because they are different targets — see [§3](03-build-and-run.md).

## 1.2 What crosses the bridge

Four groups of channels, and they all follow one pattern: the names in `src/types/…IpcChannels.ts`, the shapes in `src/types/…IpcTypes.ts`, a handler in `src/main/ipc/`, and the preload publishing one function per thing the renderer may ask for.

| Group | Files | Role |
| --- | --- | --- |
| App info | `src/types/AppInfoIpcChannels.ts` `AppInfoTypes.ts`, `src/main/ipc/AppInfoIpc.ts` | Which build the renderer is part of |
| The ledger | `src/types/LedgerIpcChannels.ts` `LedgerIpcTypes.ts`, `src/main/ipc/LedgerIpc.ts` | Everything about the file: the two dialogs, reading, creating, saving, the copies, where the copies live, the recent list, the preferences, and the one answer to a shutdown that is not a close |
| Diagnostics | `src/types/LedgerIpcChannels.ts`, `src/main/ipc/DiagnosticsIpc.ts` | The renderer's failures, written into the operational log by the process that owns it |
| Prices | `src/types/PriceIpcChannels.ts` `PriceIpcTypes.ts`, `src/main/ipc/PricesIpc.ts` | **The one thing in the application that touches the network**: a listing per security out, a quote or a reason back, and the line saying what the confirmation wrote |

`src/main/preload/Preload.ts` publishes them as `window.spiccioliAppInfo`, `window.spiccioliLedger`, `window.spiccioliPrices` and `window.spiccioliDiagnostics`, and `src/vite-env.d.ts` tells TypeScript what `window` carries.

A channel is a request the renderer makes and the main process answers. For events pushed the other way, the framework's `subscribeToChannel` (`src/framework/preload/IpcBridge.ts`) is what the preload wraps a listener in, so the renderer gets the payload without an Electron event object it could not receive anyway. Four events are pushed today, all of them the ledger's: a write attempt that failed, an external modification, a File-menu command, and the request to finish saving before the session closes.

**Nothing on any of these channels carries a parsed ledger.** The renderer holds the model and the main process owns the file, so what crosses is text and paths — plus, in the other direction, the schema version and record counts the renderer read out of a file, sent back only so that the main process can write them into the log.

**The price channel is where the network lives, and it lives there for the same reason.** The renderer knows which securities exist and the main process is the side that may open a socket, so the renderer hands over one listing per security — a `ticker` and an `exchange`, plus an identity that never goes further than `src/main/prices` — and is handed back a quote or the reason there is none. **Nothing on it writes anything**: a confirmed pass writes Price records through the document the renderer already holds ([§7.6](../functional/specs/07-investments.md#76-prices)). The renderer could not make the request itself in any case — the Content-Security-Policy of [§1.5](#15-what-the-window-is-allowed-to-load) is `default-src 'self'`, so the page has nowhere to connect to.

## 1.3 Layers inside the renderer

```
src/index.tsx                    mounts React, in StrictMode
  └── TranslationProvider        the translator every component reads wording from (§5)
      └── AppErrorBoundary       catches a render failure so the window is never left empty
          └── PreferencesProvider  the ten preferences, which are not in the ledger (§10 of the analysis)
              └── UnsavedDraftProvider  the guard every departure goes through, above the file because closing it is one
                  └── LedgerProvider   the open file: the document, the save state, the storage lines
                      └── ChecksProvider  the fourteen checks and the five pairings, run over whatever file is open (§9)
                          └── HashRouter   the one router, installed once, over a hash history
                              └── SpiccioliApp the launch screen, or the shell around one of the screens
```

`AppErrorBoundary` wraps everything below the translator rather than one screen, so a failure inside a context provider is caught too. Its recovery is a reload: rendering the same tree again would usually throw the same error a second time, while a reload starts over from what is on disk.

The failure goes to the operational log over `window.spiccioliDiagnostics`, because the renderer console is developer-facing and an installed Spiccioli cannot open it. **The renderer chooses neither the message nor the level**: it sends three texts and `src/main/ipc/DiagnosticsIpc.ts` decides what the entry is called and how long each text may be, so nothing the renderer sends can grow a log line without limit.

`LedgerProvider` is where the model lives. It reads the file the main process hands it, writes the text the main process puts on disk, debounces the autosave, and owns the three things [§12](../functional/specs/12-storage.md) puts on screen — the save state, the line while a failed write is being retried and the blocking message after the fifth attempt, and the line saying something else changed the file.

`PreferencesProvider` carries a second thing besides the preferences: `useFormatter`, the reading of them that turns a stored figure or a day into what [§10](../functional/specs/10-settings.md) says it looks like. A screen never reads a separator or a date format itself, which is what makes changing a preference re-render every figure in the same pass.

`ChecksProvider` sits **below** `LedgerProvider` and above the router, because it reads the open file and every screen reads it: the sidebar badge, the Checks screen, and the *Matched* columns of Transactions, Purchases and Sales. **The pairings and the checks are one computation with two readers** ([§11.6](../functional/specs/11-calculations.md#116-derived-matching)) — the checks report what the matching left over and the columns name what it paired — so a cell names its counterpart on the same run that reports it. **The run is debounced**, a change scheduling one rather than performing one and a scheduled run being superseded by the next; **the first run of a file is not**, there being no previous results to show while it waits.

`UnsavedDraftProvider` sits **above** `LedgerProvider`, because two of the three departures it guards are the file's: **the rule list of [§6.2](../functional/specs/06-categories.md#62-rules) is the one thing on screen that is not in the file**, so leaving the screen, closing the file and quitting all ask first, and each offers discard and stay and nothing else. A screen holding a draft registers it, the sidebar routes its links through the guard because the router is declarative and has no blocker of its own, and a quit that is stayed is called off in the main process over `cancelClose` — the only answer to *prepare for close* that is not a close.

**The router is installed once, at the root, and the launch screen is not a route.** `SpiccioliApp` is still the two states — no file, or one open — and the routes live inside the shell, so a file that is not open has no screen to be on. `AppShell` sends the shell back to Portfolio whenever the open file changes, because which screen was last looked at is not remembered ([§12.2](../functional/specs/12-storage.md#122-the-menu-bar-and-which-file-is-open)).

## 1.4 What the main process does at startup

`src/main/Main.ts`, in order:

1. **Installs the crash handlers** before anything can fail. An uncaught exception or an unhandled rejection would otherwise leave no window and no trace, because the startup below runs inside a promise.
2. **Resolves the language** first of all, so that every failure from here on has wording to report itself with (see [§5](05-text-and-languages.md)).
3. **Resolves the window load target** — the built `build/index.html` or the development server — so every window of the run loads the same page.
4. **Resolves the runtime paths**, **initializes the logger** into them, opens the configuration store, and writes the one entry that describes the run (`src/main/config/StartupConfigurationLog.ts`).
5. **Creates the ledger session** and **registers the IPC handlers.**
6. **Installs the application menu** — the File menu of four actions and the About item of [§12.2](../functional/specs/12-storage.md#122-the-menu-bar-and-which-file-is-open), rebuilt whenever the recent list changes because Open Recent is part of it.
7. **Creates the window**, installs the navigation guard on it, and shows it maximized once it is ready to be shown.

**A quit is not immediate while a file is open.** All four File actions and the window closing are the same event — a close of the session, which takes its backup — and the renderer is the side that has to finish saving first. The main process asks it to and waits, with a bound: a renderer that cannot answer must not be able to stop the application from exiting, and what is lost by quitting anyway is a copy of a file that is already safely on disk.

A failure anywhere in that sequence is logged, reported to the user if the language got as far as being resolved, and then quits the application rather than leaving a process with no window.

## 1.5 What the window is allowed to load

Two independent restrictions, because they answer different questions.

- **The Content-Security-Policy in `index.html`** says what the page may load. It is strict, and Vite relaxes it for the development server's page only (see [§3](03-build-and-run.md)).
- **The navigation guard**, `installWindowNavigationGuard` from the framework, says where the page may go. A CSP does not stop a link or a script from navigating the whole renderer elsewhere, and that page would sit behind the same preload bridge. The guard refuses every navigation away from the page the main process chose, and denies every request to open a second window. A router moving through the URL fragment stays on the same document and never reaches it, so client-side routing is unaffected.

On top of both: the development server URL is read from the environment, and `src/main/window/WindowLoadTarget.ts` refuses it outright when `app.isPackaged`. Anything able to set an environment variable would otherwise choose the page that ends up behind the bridge.

## 1.6 Where the installation's own files live

`src/main/config/SpiccioliRuntimePaths.ts` resolves them from Electron's user-data folder:

| | Packaged run | Development run |
| --- | --- | --- |
| Root | the user-data folder | a `dev/` folder inside it |
| Preferences and recent files | `spiccioli-config.json` | same, under `dev/` |
| Operational log | `logs/spiccioli-logs.ndjson` | same, under `dev/` |

A development run keeps its own root so it never touches the real preferences, the real recent-file list or the real logs.

**The ledger is not in this table and never will be.** It lives wherever the user put it, and its backups live beside it in a folder named after it — the file's own name without its extension, plus `-backups`, resolved by `src/main/storage/LedgerBackupNaming.ts` ([§12](../functional/specs/12-storage.md)). That is why the framework's own `RuntimePaths` is not used here: its layout resolves a database folder and a default backup folder inside the user-data folder, and both would be paths nothing ever writes to. See [§4](04-framework.md).

The configuration file holds two things, through `src/main/config/SpiccioliConfigStore.ts`: the ten preferences and the list of recently opened files. Neither is in the ledger, so both survive switching files and neither travels with a ledger that is copied.

## 1.7 What is deliberately not here yet

- **One of the eight screens does not read its own records yet** — Portfolio. It exists, the sidebar reaches it and it shows the empty state of [§14](../functional/specs/14-empty-and-error-states.md); its cards, its chart and its calculations arrive with Phase 11. The other seven are finished.
- **No single-instance lock.** Spiccioli is allowed to run twice. Two ledgers open side by side is ordinary use, and two sessions on *one* ledger is the case [§12](../functional/specs/12-storage.md) settles by detecting the external modification and keeping the displaced version — not by refusing to start.

---

[§2 Repository map →](02-repository-map.md)
