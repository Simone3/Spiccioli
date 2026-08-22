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

Five groups of channels, and they all follow one pattern: the names in `src/types/…IpcChannels.ts`, the shapes in `src/types/…IpcTypes.ts`, a handler in `src/main/ipc/`, and the preload publishing one function per thing the renderer may ask for.

| Group | Files | Role |
| --- | --- | --- |
| App info | `src/types/AppInfoIpcChannels.ts` `AppInfoTypes.ts`, `src/main/ipc/AppInfoIpc.ts` | Which build the renderer is part of |
| The menu bar | `src/types/AppMenuIpcChannels.ts` `AppMenuTypes.ts`, `src/main/ipc/AppMenuIpc.ts` | **Only where the window has no menu bar of its own**: what the renderer draws in its place, when it changed, and the closed set of commands a drawn entry asks for |
| The ledger | `src/types/LedgerIpcChannels.ts` `LedgerIpcTypes.ts`, `src/main/ipc/LedgerIpc.ts` | Everything about the file: the two dialogs, reading, creating, saving, the copies, where the copies live, the recent list, the preferences, and the two answers to a shutdown that are not a close — calling it off, and holding its wait while the user answers for changes the file never took |
| Diagnostics | `src/types/LedgerIpcChannels.ts`, `src/main/ipc/DiagnosticsIpc.ts` | The renderer's failures, written into the operational log by the process that owns it |
| Prices | `src/types/PriceIpcChannels.ts` `PriceIpcTypes.ts`, `src/main/ipc/PricesIpc.ts` | **The one thing in the application that touches the network**: a listing and a span per security out, the days it carries or a reason back, how far the pass has got while it runs, and the line saying what the confirmation wrote |

`src/main/preload/Preload.ts` publishes them as `window.spiccioliAppInfo`, `window.spiccioliAppMenu`, `window.spiccioliLedger`, `window.spiccioliPrices` and `window.spiccioliDiagnostics`, and `src/vite-env.d.ts` tells TypeScript what `window` carries.

A channel is a request the renderer makes and the main process answers. For events pushed the other way, the framework's `subscribeToChannel` (`src/framework/preload/IpcBridge.ts`) is what the preload wraps a listener in, so the renderer gets the payload without an Electron event object it could not receive anyway. Five events are pushed today. Four are the ledger's: a write attempt that failed, an external modification, a File-menu command, and the request to finish saving before the session closes. The fifth is the drawn menu bar's, sent whenever the menu is rebuilt — which is every time the recent list changes Open Recent underneath it.

**Nothing on any of these channels carries a parsed ledger.** The renderer holds the model and the main process owns the file, so what crosses is text and paths — plus, in the other direction, the schema version and record counts the renderer read out of a file, sent back only so that the main process can write them into the log.

**The menu channel carries a description one way and a command name the other, and nothing else.** The main process owns the menu, so the renderer is handed what to draw rather than deciding it, and what it may send back is a closed set: an unknown command name is ignored rather than guessed at, and the one command that carries a value — the file *Open Recent* was asked for — is refused unless the recent list actually holds it. The File entries of the drawn menu reach the very callbacks the native menu items click, so a file is never opened or closed by two different routes.

**The price channel is where the network lives, and it lives there for the same reason.** The renderer knows which securities exist and the main process is the side that may open a socket, so the renderer hands over one listing per security — a `ticker`, an `exchange` and the first day wanted, plus an identity that never goes further than `src/main/prices` — and is handed back the days the provider carries or the reason there are none. **It is also the one channel that pushes**: a pass asked for years of days at a time is slow enough that the screen has to say how far it has got, so `PricesIpc` sends a count back to the window that asked and to no other. **Nothing on it writes anything**: a confirmed pass writes Price records through the document the renderer already holds ([§7.6](../functional/specs/07-investments.md#76-prices)). The renderer could not make the request itself in any case — the Content-Security-Policy of [§1.5](#15-what-the-window-is-allowed-to-load) is `default-src 'self'`, so the page has nowhere to connect to.

## 1.3 Layers inside the renderer

```
src/index.tsx                    mounts React, in StrictMode
  └── AppErrorBoundary           catches a render failure so the window is never left empty
      └── PreferencesProvider    the thirteen preferences, which are not in the ledger (§10 of the analysis)
          └── TranslationProvider  the translator every component reads wording from (§5)
              └── UnsavedDraftProvider  the guard every departure goes through, above the file because closing it is one
                  └── LedgerProvider   the open file: the document, the save state, the storage lines
                      └── ChecksProvider  the fourteen checks and the five pairings, run over whatever file is open (§9)
                          └── HashRouter   the one router, installed once, over a hash history
                              └── ScreenMemoryProvider what each screen is found showing while the file stays open (§12.2)
                                  └── SpiccioliApp the launch screen, or the shell around one of the screens
```

`SpiccioliApp` puts `TitleBar` above both of its states, and on most platforms it draws nothing at all: the main process answers with no menu, and the window keeps the title bar and the menu bar the operating system gave it. Where it does draw — Windows, outside a development run — the row is the menu bar and the window title both, so the launch screen needs it as much as an open file does. The file's name is read from `LedgerProvider` rather than from the window, because `setTitle` in the main process is invisible to the page.

`AppErrorBoundary` is the outermost thing in the tree rather than a wrapper around one screen, so a failure inside any context provider is caught too. **Its wording comes from a translator it builds itself**, not from the context: what it exists to report includes a provider failing, and a crash screen that read the tree it is replacing would go down with it. The language is resolved once at load and nothing changes it, so it loses nothing by not reading it from above. Its recovery is a reload: rendering the same tree again would usually throw the same error a second time, while a reload starts over from what is on disk.

The failure goes to the operational log over `window.spiccioliDiagnostics`, because the renderer console is developer-facing and an installed Spiccioli cannot open it. **The renderer chooses neither the message nor the level**: it sends three texts and `src/main/ipc/DiagnosticsIpc.ts` decides what the entry is called and how long each text may be, so nothing the renderer sends can grow a log line without limit.

`LedgerProvider` is where the model lives. It reads the file the main process hands it, writes the text the main process puts on disk, debounces the autosave, and owns the three things [§12](../functional/specs/12-storage.md) puts on screen — the save state, the line while a failed write is being retried and the blocking message after the fifth attempt, and the line saying something else changed the file.

**Every write of the open file goes through the one scheduler**, the blocking message's own *Retry* included: it is `saveNow` rather than a save of its own, because a second writer on one file is the thing the main process's queue exists to prevent and the renderer must not be the one creating it.

**A close it cannot write is not a close.** The session is in memory and the file is the only place it can go, so `endSession` checks what the flush actually achieved: a last write that failed stops the departure and raises the fourth thing this provider puts on screen, which asks the user to give the changes up or stay with them. Nothing else can decide that — carrying on in memory, which is what the blocking message offers, is exactly what a close is not able to do.

`PreferencesProvider` carries a second thing besides the preferences: `useFormatter`, the reading of them that turns a stored figure or a day into what [§10](../functional/specs/10-settings.md) says it looks like. A screen never reads a separator or a date format itself, which is what makes changing a preference re-render every figure in the same pass.

**`TranslationProvider` sits below it, and that is the whole reason for the order.** A count inside a sentence is the same figure to the reader as an amount in the column beside it, so the translator is handed `useFormatter`'s own way of writing a whole number and every `{placeholder}` holding a number follows the preferences rather than the operating system's locale ([§5.4](05-text-and-languages.md#54-placeholders-plurals-and-numbers)). Changing a separator therefore rebuilds the translator and redraws every sentence on screen, in the same pass as every figure.

`ChecksProvider` sits **below** `LedgerProvider` and above the router, because it reads the open file and every screen reads it: the sidebar badge, the Checks screen, and the *Matched* columns of Transactions, Purchases and Sales. **The pairings and the checks are one computation with two readers** ([§11.6](../functional/specs/11-calculations.md#116-derived-matching)) — the checks report what the matching left over and the columns name what it paired — so a cell names its counterpart on the same run that reports it. **The run is debounced**, a change scheduling one rather than performing one and a scheduled run being superseded by the next; **the first run of a file is not**, there being no previous results to show while it waits.

`UnsavedDraftProvider` sits **above** `LedgerProvider`, because two of the three departures it guards are the file's: **the rule list of [§6.2](../functional/specs/06-categories.md#62-rules) is the one thing on screen that is not in the file**, so leaving the screen, closing the file and quitting all ask first, and each offers discard and stay and nothing else. A screen holding a draft registers it, the sidebar routes its links through the guard because the router is declarative and has no blocker of its own, and a quit that is stayed is called off in the main process over `cancelClose` — the only answer to *prepare for close* that is not a close.

**The router is installed once, at the root, and the launch screen is not a route.** `SpiccioliApp` is still the two states — no file, or one open — and the routes live inside the shell, so a file that is not open has no screen to be on. `AppShell` sends the shell back to Portfolio whenever the open file changes, because which screen was last looked at is not remembered between files ([§12.2](../functional/specs/12-storage.md#122-the-menu-bar-and-which-file-is-open)).

`ScreenMemoryProvider` sits **below** the router and holds what each screen is found showing while one file stays open — the tab, the filters and the row selected, and nothing a screen was in the middle of doing. **A screen keeps its own state and this is only where it survives being unmounted**: `useRemembered` is `useState` with a read of the memory at mount and a write of it after every change, so a screen the router has taken down is rebuilt showing what it showed. **It is a ref and never state**, because nothing renders from it — a write of it must not redraw the screen that made it.

**Two things empty it, and they are the two the specification names.** `AppShell` empties the whole of it in the same effect that lands a newly opened file on Portfolio, the memory describing the open file and ending where it does; `ScreenHandoff` empties one screen's before navigating to it, which is what makes an arrival from a report cell, a finished import or a check entry a fresh one. **Both hand-overs were merged into that one module for exactly this reason** — forgetting and navigating are one action, and a second module that navigated with location state of its own would eventually forget to forget.

## 1.4 What the main process does at startup

`src/main/Main.ts`, in order:

1. **Installs the crash handlers** before anything can fail. An uncaught exception or an unhandled rejection would otherwise leave no window and no trace, because the startup below runs inside a promise.
2. **Resolves the language** first of all, so that every failure from here on has wording to report itself with (see [§5](05-text-and-languages.md)).
3. **Resolves the window load target** — the built `build/index.html` or the development server — so every window of the run loads the same page.
4. **Resolves the runtime paths**, **opens the configuration store**, **initializes the logger** into them at the level the preferences hold, and writes the one entry that describes the run (`src/main/config/StartupConfigurationLog.ts`). The store comes before the logger, and has to: `logLevel` is a preference, and the very first entry is written under it. Reading the configuration file writes nothing, so nothing is lost by having no logger for the length of one read, and a file that cannot be read comes back as the defaults.
5. **Creates the ledger session** and **registers the IPC handlers.**
6. **Installs the application menu** — the File menu of four actions and the About item of [§12.2](../functional/specs/12-storage.md#122-the-menu-bar-and-which-file-is-open), with the Edit, View and Window menus each platform expects beside them, rebuilt whenever the recent list changes because Open Recent is part of it. **A development run gets three entries more** — reload, force reload and the developer tools — which an installed Spiccioli does not offer. The same call rebuilds the description the renderer draws from, where it draws one, and tells the window it changed.
7. **Creates the window**, installs the navigation guard and the close guard on it, and shows it maximized once it is ready to be shown. Where the renderer draws the menu bar the window is created without a title bar of its own, with the two colors Electron overlays the window buttons in, and the native menu bar — installed, because its items are what answer the keyboard — is hidden.

**Which platform draws the menu bar is decided once, before the window exists.** Windows draws its own in its own grey, above a window that is dark, and nothing in Electron can restyle it, so the renderer draws one instead in the colors of the application; macOS puts the menu where it belongs to the desktop rather than the window, and Linux is left alone because hiding the menu bar there means taking the window buttons over too. A development run keeps the native bar everywhere, which is where its reload and developer-tools entries stay reachable.

**A quit is not immediate while a file is open, and neither is closing the window.** All four File actions and the window closing are the same event — a close of the session, which takes its backup — and the renderer is the side that has to finish saving first. So both are stopped once: `before-quit` for the quit, and the window's own `close` for the window, which has to be caught there because a destroyed window takes the renderer down with it, and with it the model, the debounced write nobody has asked for yet and the closing copy that was supposed to be taken.

The main process then asks the renderer to finish and waits, with a bound — but **the bound is on being idle, not on the whole close**. A renderer that cannot answer must not be able to stop the application from exiting; a renderer that is *writing* is answering, and a write has five attempts with a timeout each, which is far longer than the seconds an unresponsive one is given. Cutting that off at the idle bound would throw away the very changes the close exists to finish writing. So the clock runs only while nothing is moving — `session.isWriting()` is what says so, and the renderer can hold it off too while it puts a question to the user — and a second, much longer bound covers the whole thing so that no state can hold the application open forever. Both are in `SHUTDOWN_CONFIG`, and the longer one is derived from the retry budget rather than guessed at.

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

The configuration file holds two things, through `src/main/config/SpiccioliConfigStore.ts`: the thirteen preferences and the list of recently opened files. Neither is in the ledger, so both survive switching files and neither travels with a ledger that is copied. **The log folder is the one of these paths the interface states**, on Settings and read-only, because `logLevel` decides what lands in it.

**Two of the preferences are acted on by the main process rather than only read by the renderer**, so both are followed live: `backupCount` is read again at each close, and `logLevel` reaches `appLogger.setLevel` through the `onPreferencesChanged` callback `Main.ts` gives the ledger IPC handlers. A preference applies the moment it is changed, and neither of those two is an exception.

## 1.7 What is deliberately not here yet

- **No single-instance lock.** Spiccioli is allowed to run twice. Two ledgers open side by side is ordinary use, and two sessions on *one* ledger is the case [§12](../functional/specs/12-storage.md) settles by detecting the external modification and keeping the displaced version — not by refusing to start. **That is why the atomic write's temporary file carries the writing process's id** (`src/main/storage/LedgerBackupNaming.ts`): the queue in `LedgerSession` keeps one run's writes apart, and nothing in one process can keep it from another's, so the two of them are kept out of one temporary file by name. Two writers filling one of those interleave their bytes, and the rename puts the splice on the ledger.

---

[§2 Repository map →](02-repository-map.md)
