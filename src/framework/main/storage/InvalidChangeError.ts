interface InvalidChangeError extends Error {
	invalidChange: true;
}

/**
 * Marks an error as a change the database will never accept, such as a write against a row that is not there.
 * Retrying it would fail in exactly the same way and would hold up every change made afterwards, so storage reports it as refused instead of as a database failure.
 * @param message Message explaining why the change cannot be written.
 * @returns The marked error.
 */
export const createInvalidChangeError = (message: string): InvalidChangeError => {
	const error = new Error(message) as InvalidChangeError;
	error.invalidChange = true;

	return error;
};

/**
 * Tells whether an error marks a change the database will never accept.
 * @param error Thrown value.
 * @returns True when the change was refused rather than failed.
 */
export const isInvalidChangeError = (error: unknown): error is InvalidChangeError => {
	return Boolean(
		error &&
		typeof error === 'object' &&
		(error as Partial<InvalidChangeError>).invalidChange
	);
};
