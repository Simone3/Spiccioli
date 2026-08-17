/**
 * The channel names both processes import, so that neither spells one out.
 * The "invoke" channels are requests the renderer makes and the main process answers; the "event" ones are pushed the other way.
 */
export const SPICCIOLI_LEDGER_IPC_CHANNELS = {
	chooseFileToOpen: 'spiccioli:ledger:choose-file-to-open',
	chooseFileToCreate: 'spiccioli:ledger:choose-file-to-create',
	readFile: 'spiccioli:ledger:read-file',
	acceptFile: 'spiccioli:ledger:accept-file',
	rejectFile: 'spiccioli:ledger:reject-file',
	createFile: 'spiccioli:ledger:create-file',
	save: 'spiccioli:ledger:save',
	writePreUpgradeBackup: 'spiccioli:ledger:write-pre-upgrade-backup',
	completeUpgrade: 'spiccioli:ledger:complete-upgrade',
	closeSession: 'spiccioli:ledger:close-session',
	cancelClose: 'spiccioli:ledger:cancel-close',
	getBackupDirectory: 'spiccioli:ledger:get-backup-directory',
	getRecentFiles: 'spiccioli:ledger:get-recent-files',
	dismissRecentFile: 'spiccioli:ledger:dismiss-recent-file',
	getPreferences: 'spiccioli:ledger:get-preferences',
	setPreferences: 'spiccioli:ledger:set-preferences'
} as const;

export const SPICCIOLI_LEDGER_IPC_EVENTS = {
	writeAttemptFailed: 'spiccioli:ledger:write-attempt-failed',
	externalModification: 'spiccioli:ledger:external-modification',
	menuCommand: 'spiccioli:ledger:menu-command',
	prepareForClose: 'spiccioli:ledger:prepare-for-close'
} as const;

export const SPICCIOLI_DIAGNOSTICS_IPC_CHANNELS = {
	reportRenderError: 'spiccioli:diagnostics:report-render-error'
} as const;
