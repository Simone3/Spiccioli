# §4 — Framework layer

*[Index](README.md) · [← §3 Build and run](03-build-and-run.md)*

---

## 4.1 What it is

`src/framework` is scaffolding that knows nothing about Spiccioli: logging, crash handling, window safety, translation machinery, a configuration store, storage and backup building blocks, and a few utilities. It is meant to be lifted into another desktop application as it is.

**It came from SPOT, the application it was first written in, and the two copies are meant to stay in step.** The two projects improve it in turn, and a divergence that starts as a small local edit is what makes carrying a fix from one to the other expensive later. So a change that belongs in the framework is made in the framework, in both places — and never as a local edit that quietly makes this copy Spiccioli's.

**It is no longer byte-identical to SPOT's copy, and the difference is additive.** The three whole-file storage modules of [§4.2](#42-what-spiccioli-uses-today) were written here, for a model SPOT does not have, and `utils/Paging.ts` was written here too. They sit **beside** SPOT's own modules rather than replacing them, and none of those was edited — which makes them the change to carry back rather than a divergence to reconcile.

**The rule that keeps it liftable** is enforced by ESLint: nothing under `src/framework` may import from `src/components`, `src/contexts`, `src/logic`, `src/main`, `src/types`, `src/utils`, `src/config` or `src/index*`. Everything it needs about the application arrives through its options — configuration values, wording, clocks. It holds no module-level state either, so everything is created by a factory; the process-wide `appLogger` and the pure `Intl` memoization caches inside the translator are the only exceptions.

## 4.2 What Spiccioli uses today

| Module | Used for |
| --- | --- |
| `i18n/Translator.ts` | The translator behind every user-facing string ([§5](05-text-and-languages.md)) |
| `i18n/LanguageResolution.ts` | Picking the language out of the ones a bundle exists for |
| `types/TranslationTypes.ts` | The bundle shape and the typed key |
| `renderer/TranslationContext.tsx` | The React binding of the translator |
| `renderer/ErrorBoundary.tsx` | The catch behind `AppErrorBoundary` |
| `main/config/JsonConfigStore.ts` | The preferences and the recent-file list, behind `src/main/config/SpiccioliConfigStore.ts`. **Written atomically**, because it reads a file it cannot parse as a first startup — so a truncated write would not be an error but every preference silently gone |
| `main/logging/AppLogger.ts` | The operational log, as rotated NDJSON |
| `main/storage/WholeFileStorage.ts` | Reading and writing a whole file, the atomic replace by temp-file-and-rename, and the SHA-256 that recognises one that changed underneath |
| `main/storage/RetryingFileWriter.ts` | The five spaced attempts, the write timeout, and offering the displaced bytes before overwriting them |
| `main/storage/FileBackupRotation.ts` | A folder of copies kept to a count, oldest out first as they arrive |
| `preload/IpcBridge.ts` | `subscribeToChannel`, which is how the four main-to-renderer events reach the page |
| `main/logging/ProcessCrashHandlers.ts` | Uncaught exceptions and unhandled rejections in the main process |
| `main/window/WindowLoadTarget.ts` | Built file or development server |
| `main/window/WindowNavigationGuard.ts` | Keeping the window on the page the main process chose |
| `utils/ErrorUtils.ts` | Turning an unknown thrown value into a message |
| `utils/Paging.ts` | The arithmetic behind the two paginated tables: how many pages a list makes, which rows one page holds, and which page a row sits on. **How long a page is is passed in**, so the transactions list at fifty and a price history at twenty share the one implementation ([§5.2](../functional/specs/05-transactions.md#52-ordering-and-paging), [§7.4](../functional/specs/07-investments.md#74-securities)) |

## 4.3 What is present and not used yet

The rest of the framework came along with the copy. Some of it Spiccioli will use as it grows; some of it describes a persistence model Spiccioli does not have. Knowing which is which is the point of this table.

**None of it is deleted, and that is decided rather than deferred** (D6, [§8.1](08-decisions.md#81-the-fourteen-decisions)). [§4.1](#41-what-it-is) keeps this folder in step with SPOT's copy on purpose, and removing the modules Spiccioli happens not to use would diverge the two for no gain — the next fix carried between them costs more than the idle code does. A module that does not apply says so here and stays compiled, linted and tested.

| Module | Status |
| --- | --- |
| `utils/DateUtils.ts` | **In use.** It parses and writes the stored `YYYY-MM-DD` day every screen reads, and it holds the day arithmetic the match windows, the check ages and the net worth line's month ends are built on — `addDays`, `addMonths` with its clamp, `dayDifference`. **Printing a day is not its job**: that goes through `src/logic/format/DateFormat.ts`, because the format is a preference rather than a locale |
| `main/storage/AppDatabase.ts` | **Does not apply.** A wrapper over Electron's bundled `node:sqlite`, with migrations. The ledger is one JSON document (D1, [§8.1](08-decisions.md#81-the-fourteen-decisions)), so nothing here will open a database. Its own comment on WAL is part of why: it is safe because that database is never in a synchronized folder, and Spiccioli's ledger is allowed to be in one ([§12](../functional/specs/12-storage.md)) |
| `main/config/RuntimePaths.ts` | **Does not apply.** Its layout resolves a database folder and a default backup folder inside the user-data folder. Spiccioli's ledger is wherever the user put it and its backups sit beside it, so both would be paths nothing writes to. `src/main/config/SpiccioliRuntimePaths.ts` resolves the two that do exist |
| `main/config/BackupLocationManager.ts`, `main/storage/BackupDirectory.ts`, `main/ipc/BackupLocationIpc.ts`, `types/BackupTypes.ts` | **Do not apply.** They exist to let the user choose a backup folder and to refuse an unusable one. Spiccioli never asks: the backup folder is derived from the ledger's own name and directory ([§12](../functional/specs/12-storage.md)) |
| `main/storage/DatabaseStorage.ts`, `main/storage/DatabaseBackup.ts`, `main/storage/BackupScheduler.ts`, `main/storage/InvalidChangeError.ts`, `main/ipc/StorageCommandIpc.ts`, `renderer/StorageQueue.ts`, `types/StorageTypes.ts` | **Do not apply as they are.** They implement one write per user command against a database that never moves, with periodic backups to the chosen folder. Spiccioli autosaves a whole file, debounced and atomically, retries a failed write five times, detects that something else changed the file, and takes one backup per session on close. **The second storage layer sits beside these rather than replacing them** (D5, D6): the two models coexist in the folder, each with its own tests, and the whole-file one is what [§12](../functional/specs/12-storage.md) is built on |
| `utils/ManuallySortedList.ts` | **Does not apply.** Nothing in Spiccioli is ordered by hand |

The unused modules are compiled, linted and covered by their own tests, so they stay honest while they wait. Deleting one is a decision to make when the section that replaces it is written, not before.

## 4.4 The logger

`appLogger` is the one process-wide object in the framework, because a crash handler has to be able to reach it before anything has been constructed. `initializeAppLogger` points it at a directory, a file name, a maximum size, a number of archives to keep and **the level it opens at**; until then, calls report that logging is not initialized rather than throwing.

It writes NDJSON — one JSON object per line, with a timestamp, a level, a message and whatever fields the caller passed. That is a format a person can read with `tail` and a script can parse without a grammar.

**The level is filtered here rather than on the backend's transport**, so the four names `APP_LOG_LEVELS` holds are the only scale in play and none of the backend's own extra ones can ever be in force. A level admits itself and everything more severe, and **an entry below it is never serialized and never handed over** — which is what makes a `debug` call affordable to leave in the code. `setLevel` moves it while the application runs, because the caller may well be holding it as a user preference, and `getConfiguration` reports the one currently in force. The framework's own default is `debug`, so an application that says nothing about it keeps everything; Spiccioli passes the `logLevel` preference of [§10](../functional/specs/10-settings.md) instead.

Spiccioli logs into `logs/spiccioli-logs.ndjson` under the runtime root of [§1.6](01-architecture.md#16-where-the-installations-own-files-live).

This section is the mechanism. **What is written into it, entry by entry, is D14** ([§8.4](08-decisions.md#84-what-d14-logs)): the startup entry, every storage operation, the renderer's failures, the price pass — and the rule that no figure or text out of the ledger is ever among the fields.

## 4.5 Adding to it

Put new code in `src/framework` only when it would be just as useful to a different application, and in Spiccioli otherwise. Moving something into the framework later is easy; untangling application knowledge out of it is not.

When you do, remember the copy: the same change belongs in the other project's framework, or the two have diverged.

---

[← §3 Build and run](03-build-and-run.md) · [§5 Text and languages →](05-text-and-languages.md)
