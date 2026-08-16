# §4 — Framework layer

*[Index](README.md) · [← §3 Build and run](03-build-and-run.md)*

---

## 4.1 What it is

`src/framework` is scaffolding that knows nothing about Spiccioli: logging, crash handling, window safety, translation machinery, a configuration store, storage and backup building blocks, and a few utilities. It is meant to be lifted into another desktop application as it is.

It came here from SPOT, the application it was first written in, and it is kept **byte-identical to that copy on purpose**. The two projects are expected to improve it in turn, and a divergence that starts as a small local edit is what makes carrying a fix from one to the other expensive later. A change that belongs in the framework is made in the framework, in both places.

**The rule that keeps it liftable** is enforced by ESLint: nothing under `src/framework` may import from `src/components`, `src/contexts`, `src/logic`, `src/main`, `src/types`, `src/utils`, `src/config` or `src/index*`. Everything it needs about the application arrives through its options — configuration values, wording, clocks. It holds no module-level state either, so everything is created by a factory; the process-wide `appLogger` and the pure `Intl` memoization caches inside the translator are the only exceptions.

## 4.2 What Spiccioli uses today

| Module | Used for |
| --- | --- |
| `i18n/Translator.ts` | The translator behind every user-facing string ([§5](05-text-and-languages.md)) |
| `i18n/LanguageResolution.ts` | Picking the language out of the ones a bundle exists for |
| `types/TranslationTypes.ts` | The bundle shape and the typed key |
| `renderer/TranslationContext.tsx` | The React binding of the translator |
| `renderer/ErrorBoundary.tsx` | The catch behind `AppErrorBoundary` |
| `main/logging/AppLogger.ts` | The operational log, as rotated NDJSON |
| `main/logging/ProcessCrashHandlers.ts` | Uncaught exceptions and unhandled rejections in the main process |
| `main/window/WindowLoadTarget.ts` | Built file or development server |
| `main/window/WindowNavigationGuard.ts` | Keeping the window on the page the main process chose |
| `utils/ErrorUtils.ts` | Turning an unknown thrown value into a message |

## 4.3 What is present and not used yet

The rest of the framework came along with the copy. Some of it Spiccioli will use as it grows; some of it describes a persistence model Spiccioli does not have, and will be replaced rather than adopted. Knowing which is which is the point of this table.

| Module | Status |
| --- | --- |
| `main/config/JsonConfigStore.ts` | **Will be used.** It is what the preferences and the recent-file list of [§10](../functional/specs/10-settings.md) are written through |
| `utils/DateUtils.ts` | **Will be used.** Dates are everywhere in the ledger, and the preferences of [§10](../functional/specs/10-settings.md) decide how they are printed |
| `preload/IpcBridge.ts` | **Will be used.** `subscribeToChannel` is how a main-to-renderer event reaches the page; nothing pushes one yet |
| `main/storage/AppDatabase.ts` | **Undecided.** A wrapper over Electron's bundled `node:sqlite`, with migrations. It applies only if the ledger format turns out to be SQLite ([§12](../functional/specs/12-storage.md) leaves the format open) |
| `main/config/RuntimePaths.ts` | **Does not apply.** Its layout resolves a database folder and a default backup folder inside the user-data folder. Spiccioli's ledger is wherever the user put it and its backups sit beside it, so both would be paths nothing writes to. `src/main/config/SpiccioliRuntimePaths.ts` resolves the two that do exist |
| `main/config/BackupLocationManager.ts`, `main/storage/BackupDirectory.ts`, `main/ipc/BackupLocationIpc.ts`, `types/BackupTypes.ts` | **Do not apply.** They exist to let the user choose a backup folder and to refuse an unusable one. Spiccioli never asks: the backup folder is derived from the ledger's own name and directory ([§12](../functional/specs/12-storage.md)) |
| `main/storage/DatabaseStorage.ts`, `main/storage/DatabaseBackup.ts`, `main/storage/BackupScheduler.ts`, `main/storage/InvalidChangeError.ts`, `main/ipc/StorageCommandIpc.ts`, `renderer/StorageQueue.ts`, `types/StorageTypes.ts` | **Do not apply as they are.** They implement one write per user command against a database that never moves, with periodic backups to the chosen folder. Spiccioli autosaves a whole file, debounced and atomically, retries a failed write five times, detects that something else changed the file, and takes one backup per session on close. The parts worth keeping will be taken from these deliberately, when [§12](../functional/specs/12-storage.md) is implemented |
| `utils/ManuallySortedList.ts` | **Does not apply.** Nothing in Spiccioli is ordered by hand |

The unused modules are compiled, linted and covered by their own tests, so they stay honest while they wait. Deleting one is a decision to make when the section that replaces it is written, not before.

## 4.4 The logger

`appLogger` is the one process-wide object in the framework, because a crash handler has to be able to reach it before anything has been constructed. `initializeAppLogger` points it at a directory, a file name, a maximum size and a number of archives to keep; until then, calls report that logging is not initialized rather than throwing.

It writes NDJSON — one JSON object per line, with a timestamp, a level, a message and whatever fields the caller passed. That is a format a person can read with `tail` and a script can parse without a grammar.

Spiccioli logs into `logs/spiccioli-logs.ndjson` under the runtime root of [§1.6](01-architecture.md#16-where-the-installations-own-files-live).

## 4.5 Adding to it

Put new code in `src/framework` only when it would be just as useful to a different application, and in Spiccioli otherwise. Moving something into the framework later is easy; untangling application knowledge out of it is not.

When you do, remember the copy: the same change belongs in the other project's framework, or the two have diverged.

---

[← §3 Build and run](03-build-and-run.md) · [§5 Text and languages →](05-text-and-languages.md)
