import { LEDGER_FILE_CONFIG } from 'src/config/AppConfig';

/**
 * What "not understood" means, concretely.
 *
 * A file is either opened and fully editable or not opened at all: there is no read-only mode and nothing is ever ignored. When
 * the reader refuses one it says what it did not understand, and this is the vocabulary it says it in.
 *
 * **A refusal says as much as it can about where it was raised**: the entity, the position in it, the record's own id, the
 * field, the closed set the value should have come from, and the value itself — which is what turns "something in this file is
 * wrong" into a line somebody can find in it.
 *
 * **The value is the one part of it that is shown and never written.** The figure a refusal was raised on is an amount and the
 * text is a description, and neither may reach the operational log, so the log is handed "redactLedgerRefusal" of it and never
 * the refusal itself.
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

	// The record's own id, so that the row can be found in the file by searching for it rather than by counting to it. The two
	// entities keyed by something other than an id carry their composite key here instead, and a record whose id is itself the
	// thing that was not understood carries nothing.
	recordId?: string;

	// The field, or the key that was not recognised
	field?: string;

	// The name of the closed set the value should have come from
	enumName?: string;

	// What the file actually held there, shortened to fit a sentence. **Shown to the user and never logged**: on a figure it is
	// an amount and on a text it is a description.
	value?: string;

	// Only on "unsupported-schema-version", where the version is a fact about the file rather than a value out of it
	foundSchemaVersion?: number;
	supportedSchemaVersion?: number;
}

// A refusal with the one field the log may not carry taken off it, which is the only shape that crosses to the main process
export type LoggableLedgerRefusal = Omit<LedgerRefusal, 'value'>;

/**
 * Takes the value off a refusal, leaving what may be written down.
 * @param refusal The refusal as the reader raised it.
 * @returns The same refusal, without the value it was raised on.
 */
export const redactLedgerRefusal = (refusal: LedgerRefusal): LoggableLedgerRefusal => {
	const loggable: LedgerRefusal = { ...refusal };

	delete loggable.value;

	return loggable;
};

/**
 * Renders what the file held into the text a refusal quotes back.
 * A record or a list is written as the JSON it is, so that a field holding the wrong shape still shows what that shape was, and
 * everything is cut to a length a sentence can carry.
 * @param value The raw value, straight out of the parsed file.
 * @returns The value as text, or undefined when there was no value there at all.
 */
export const describeRefusedValue = (value: unknown): string | undefined => {
	const text = typeof value === 'string' ? value : JSON.stringify(value);

	if(text === undefined) {
		return undefined;
	}

	return text.length > LEDGER_FILE_CONFIG.refusedValueLengthLimit ? `${text.slice(0, LEDGER_FILE_CONFIG.refusedValueLengthLimit)}…` : text;
};

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
