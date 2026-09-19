/**
 * The channel the renderer reads a bank export over. One request, one answer, and nothing pushed the other way.
 */
export const SPICCIOLI_IMPORT_IPC_CHANNELS = {
	readFile: 'spiccioli:import:read-file',

	// The same thing for a chooser that takes several documents at once, which is how a selection of payslips is read
	readFiles: 'spiccioli:import:read-files'
} as const;
