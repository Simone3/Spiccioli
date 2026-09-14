/**
 * The channel the renderer reads a bank export over. One request, one answer, and nothing pushed the other way.
 */
export const SPICCIOLI_IMPORT_IPC_CHANNELS = {
	readFile: 'spiccioli:import:read-file'
} as const;
