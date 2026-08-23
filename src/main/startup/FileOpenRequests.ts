import path from 'node:path';
import { appLogger } from 'src/framework/main/logging/AppLogger';

/**
 * A ledger a launch asked Spiccioli to open, held until the window comes and takes it.
 *
 * **The renderer is the side that opens a file**, because opening one ends the session that was open and only the renderer can
 * finish writing that one first. So nothing here reads, opens or closes anything: it holds a path, and that is what makes the
 * two ways in safe. A launch that *starts* Spiccioli leaves the path here for a renderer that does not exist yet and finds it on
 * mount; a launch that arrives while Spiccioli is already running leaves it here and tells the renderer to come for it. Both end
 * at the same take, and **the take clears what it returns**, so the two of them racing cannot open one file twice.
 *
 * **Asking for the file that is already open is not an open at all.** The window comes forward and the session is left exactly
 * as it is — nothing is re-read, no closing copy is taken, and nothing typed and not yet written is disturbed.
 */

export const FILE_OPEN_REQUEST_SOURCES = [ 'launch', 'second-launch', 'open-file-event' ] as const;

export type FileOpenRequestSource = typeof FILE_OPEN_REQUEST_SOURCES[number];

// Named after what reports it rather than after Node's own namespace, which nothing else in the application spells out either
export type FileOpenPlatform = typeof process.platform;

export interface FileOpenRequest {
	filePath: string;
	source: FileOpenRequestSource;
}

export interface FileOpenRequests {

	// Takes a request in. Whether it leaves a file to open behind it, or only brings the window forward, is decided here.
	request: (request: FileOpenRequest) => void;

	// The renderer taking what is waiting for it, which is also what clears it
	take: () => string | undefined;
}

export interface CreateFileOpenRequestsOptions {

	// macOS and Windows both name one file by more than one string, so the comparison against the open one follows the platform
	platform: FileOpenPlatform;

	getOpenFilePath: () => string | undefined;

	// Whatever the request turns out to be asking for, the window this application already has is the window it is asking of
	bringWindowForward: () => void;

	// Called once a file is waiting, so that a renderer already on screen comes and takes it rather than waiting for a mount
	// that has long since happened
	onFileWaiting: () => void;
}

// The case a path is written in is the file itself on Linux and is not on the other two, where one file answers to several
// spellings and all of them are it
const namesTheSameFile = (platform: FileOpenPlatform, one: string, other: string): boolean => {
	return platform === 'linux' ? one === other : one.toLowerCase() === other.toLowerCase();
};

export const createFileOpenRequests = ({
	platform,
	getOpenFilePath,
	bringWindowForward,
	onFileWaiting
}: CreateFileOpenRequestsOptions): FileOpenRequests => {
	// Spiccioli holds one file open, so it waits for one. A request arriving while another is still waiting replaces it: the
	// later one is the one the user has just made.
	let waitingFilePath: string | undefined;

	return {
		request: ({ filePath, source }) => {
			const requested = path.resolve(filePath);

			bringWindowForward();

			const openFilePath = getOpenFilePath();

			if(openFilePath !== undefined && namesTheSameFile(platform, openFilePath, requested)) {
				appLogger.info('A launch asked for the ledger that is already open', {
					type: 'ledger.open-requested',
					source,
					filePath: requested,
					outcome: 'already-open'
				});

				return;
			}

			waitingFilePath = requested;

			appLogger.info('A launch asked for a ledger to be opened', {
				type: 'ledger.open-requested',
				source,
				filePath: requested,
				outcome: 'waiting'
			});

			onFileWaiting();
		},

		take: () => {
			const taken = waitingFilePath;

			waitingFilePath = undefined;

			return taken;
		}
	};
};
