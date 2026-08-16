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

Today there is one channel, and it is the pattern every later one follows.

| Piece | File | Role |
| --- | --- | --- |
| Channel names | `src/types/AppInfoIpcChannels.ts` | The string constants both sides import, so neither spells one out |
| The shape | `src/types/AppInfoTypes.ts` | The payload type and the API the preload publishes |
| The handler | `src/main/ipc/AppInfoIpc.ts` | Registers the `ipcMain.handle` that answers |
| The bridge | `src/main/preload/Preload.ts` | Calls `ipcRenderer.invoke` and exposes it as `window.spiccioliAppInfo` |
| The declaration | `src/vite-env.d.ts` | Tells TypeScript what `window` carries |

A channel is a request the renderer makes and the main process answers. For events pushed the other way, the framework's `subscribeToChannel` (`src/framework/preload/IpcBridge.ts`) is what the preload wraps a listener in, so the renderer gets the payload without an Electron event object it could not receive anyway.

## 1.3 Layers inside the renderer

```
src/index.tsx                 mounts React, in StrictMode
  └── TranslationProvider     the translator every component reads wording from (§5)
      └── AppErrorBoundary    catches a render failure so the window is never left empty
          └── PlaceholderPage the one screen there is so far
```

`AppErrorBoundary` wraps everything below the provider rather than one screen, so a failure inside a context provider is caught too. Its recovery is a reload: rendering the same tree again would usually throw the same error a second time, while a reload starts over from what is on disk.

The failure is written to the renderer console for now. That console is developer-facing and an installed Spiccioli cannot open it, so this screen still has to reach the operational log; the channel that carries it there is written with the storage work.

## 1.4 What the main process does at startup

`src/main/Main.ts`, in order:

1. **Installs the crash handlers** before anything can fail. An uncaught exception or an unhandled rejection would otherwise leave no window and no trace, because the startup below runs inside a promise.
2. **Resolves the language** first of all, so that every failure from here on has wording to report itself with (see [§5](05-text-and-languages.md)).
3. **Resolves the window load target** — the built `build/index.html` or the development server — so every window of the run loads the same page.
4. **Resolves the runtime paths** and **initializes the logger** into them.
5. **Registers the IPC handlers.**
6. **Creates the window**, installs the navigation guard on it, and shows it maximized once it is ready to be shown.

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

**The ledger is not in this table and never will be.** It lives wherever the user put it, and its backups live beside it in a folder named after it ([§12](../functional/specs/12-storage.md)). That is why the framework's own `RuntimePaths` is not used here: its layout resolves a database folder and a default backup folder inside the user-data folder, and both would be paths nothing ever writes to. See [§4](04-framework.md).

## 1.7 What is deliberately not here yet

- **No storage.** The ledger format is undecided, so there is no persistence layer, no autosave, no backup rotation and no external-modification detection.
- **No router and no sidebar.** The eight screens of the functional analysis need one; a routing dependency arrives with the first two screens, not before.
- **No application menu.** [§12.2](../functional/specs/12-storage.md#122-the-menu-bar-and-which-file-is-open) fixes a File menu of four actions and an About item, and it is built with the launch screen that gives those actions something to act on. Until then the window carries the menu Electron installs by itself.
- **No single-instance lock.** Spiccioli is allowed to run twice. Two ledgers open side by side is ordinary use, and two sessions on *one* ledger is the case [§12](../functional/specs/12-storage.md) settles by detecting the external modification and keeping the displaced version — not by refusing to start.

---

[§2 Repository map →](02-repository-map.md)
