/**
 * Reads a human-readable message out of an unknown thrown value.
 * Anything can be thrown, and the message ends up in a log record or in front of the user either way, so a non-Error value is stringified instead of being dropped.
 * @param error Thrown value.
 * @returns The error message.
 */
export const getErrorMessage = (error: unknown): string => {
	if(error instanceof Error) {
		return error.message;
	}

	if(error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
		return error.message;
	}

	return String(error);
};
