import { accessSync, constants, existsSync, mkdirSync, statSync } from 'node:fs';

export type BackupDirectoryValidation = {
	ok: true;
} | {
	ok: false;
	message: string;
};

// A folder the user picked themselves is reported back to them when it cannot be used, so the wording is the application's
// and only the rules that decide which of these applies are the framework's
export interface BackupDirectoryMessages {
	noDirectorySelected: string;
	createMissingDirectoryMessage: (directory: string) => string;
	createNotADirectoryMessage: (directory: string) => string;
	createUnusableDirectoryMessage: (directory: string) => string;
}

/**
 * Checks that a folder exists, is a folder, and can be read and written.
 * @param directory Folder to check.
 * @param messages Wording for each way the folder can be refused.
 * @returns Whether the folder can be used, and why not when it cannot.
 */
export const validateBackupDirectory = (directory: string, messages: BackupDirectoryMessages): BackupDirectoryValidation => {
	if(!directory) {
		return {
			ok: false,
			message: messages.noDirectorySelected
		};
	}

	if(!existsSync(directory)) {
		return {
			ok: false,
			message: messages.createMissingDirectoryMessage(directory)
		};
	}

	try {
		if(!statSync(directory).isDirectory()) {
			return {
				ok: false,
				message: messages.createNotADirectoryMessage(directory)
			};
		}

		accessSync(directory, constants.R_OK);
		accessSync(directory, constants.W_OK);
	}
	catch {
		return {
			ok: false,
			message: messages.createUnusableDirectoryMessage(directory)
		};
	}

	return {
		ok: true
	};
};

export const ensureBackupDirectory = (directory: string): void => {
	mkdirSync(directory, { recursive: true });
};
