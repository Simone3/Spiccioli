/**
 * What "not understood" means, concretely.
 *
 * A file is either opened and fully editable or not opened at all: there is no read-only mode and nothing is ever ignored. When
 * the reader refuses one it says what it did not understand, and this is the vocabulary it says it in.
 *
 * **A refusal never carries a value.** It names the entity, the index, the field and the closed set the value should have come
 * from, and stops there — the figure it was raised on is an amount, and the text is a description. That is what makes a refusal
 * safe to put in front of the user and safe to write to the operational log unchanged.
 */

export const LEDGER_REFUSAL_REASONS = [

	// The bytes are not JSON at all
	'malformed-json',

	// The document, or a record inside it, is not the kind of thing it has to be
	'wrong-type',

	// A key this version has never heard of, which is the whole point of validating exhaustively
	'unknown-key',

	// A key this version requires. A value that is not there is written as null, so a key that is absent is a shape this build did not write.
	'missing-key',

	// A value outside the closed set its field takes
	'unknown-enum-value',

	// A category id this version does not seed, or a role outside the nine
	'unknown-category',

	// A figure that is not an integer at its field's scale. A fraction of a cent is a file this application did not write, and it is not rounded away.
	'non-integer-figure',

	// A date that is not a real day written as YYYY-MM-DD
	'malformed-date',

	// Two records sharing an id, or two sharing a composite key
	'duplicate-key',

	// A reference to a record the file does not hold
	'dangling-reference',

	// A schema version this build cannot know the shape of
	'unsupported-schema-version'
] as const;

export type LedgerRefusalReason = typeof LEDGER_REFUSAL_REASONS[number];

export interface LedgerRefusal {
	reason: LedgerRefusalReason;

	// Which entity the refusal was raised on, as the document's own key for it
	entity?: string;

	// Where in that entity's array, counting from 1 so that it reads as a position rather than an offset
	position?: number;

	// The field, or the key that was not recognised
	field?: string;

	// The name of the closed set the value should have come from
	enumName?: string;

	// Only on "unsupported-schema-version", where the version is a fact about the file rather than a value out of it
	foundSchemaVersion?: number;
	supportedSchemaVersion?: number;
}

// Thrown by the reader's field helpers so that the first thing not understood stops the read where it was found, rather than
// every helper having to hand a result back up through the one above it
export class LedgerRefusalError extends Error {
	readonly refusal: LedgerRefusal;

	constructor(refusal: LedgerRefusal) {
		super(`The ledger file was refused: ${refusal.reason}`);
		this.name = 'LedgerRefusalError';
		this.refusal = refusal;
	}
}

/**
 * Stops the read, naming what was not understood.
 * @param refusal What was not understood, and where.
 */
export const refuseLedger: (refusal: LedgerRefusal) => never = (refusal) => {
	throw new LedgerRefusalError(refusal);
};

/**
 * Recognises the reader's own refusal among whatever else a call might have thrown.
 * @param error The thrown value.
 * @returns Whether it is a refusal.
 */
export const isLedgerRefusalError = (error: unknown): error is LedgerRefusalError => {
	return error instanceof LedgerRefusalError;
};
