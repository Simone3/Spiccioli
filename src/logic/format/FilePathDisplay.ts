/**
 * Reading a path apart for display.
 *
 * The renderer has no Node in it, so it cannot use "node:path" — and it does not need to: nothing here resolves, joins or
 * normalises anything, it only splits a path the main process handed over so that a screen can show the name on one line and
 * the folder on another. Both separators are treated as one, because a path arrives from whichever platform this is running on.
 */

const SEPARATORS = /[\\/]/;

/**
 * The last segment of a path.
 * @param filePath The path.
 * @returns The file's own name, with its extension.
 */
export const getFileName = (filePath: string): string => {
	const segments = filePath.split(SEPARATORS);

	return segments[segments.length - 1];
};

/**
 * The file's name without its extension, which is what the window title and the backup folder are named after.
 * @param filePath The path.
 * @returns The name, with everything from the last dot removed.
 */
export const getFileNameWithoutExtension = (filePath: string): string => {
	const fileName = getFileName(filePath);
	const lastDot = fileName.lastIndexOf('.');

	return lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
};

/**
 * Everything above the file.
 * @param filePath The path.
 * @returns The folder the file is in, or an empty string when the path is a bare name.
 */
export const getDirectory = (filePath: string): string => {
	const separator = filePath.lastIndexOf('/') > filePath.lastIndexOf('\\') ? '/' : '\\';
	const lastSeparator = filePath.lastIndexOf(separator);

	return lastSeparator > 0 ? filePath.slice(0, lastSeparator) : '';
};
