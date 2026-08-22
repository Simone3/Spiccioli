import { describeRefusedValue, refuseLedger, type LedgerRefusalReason } from 'src/logic/ledger/LedgerRefusal';
import type { IsoDate, LedgerId } from 'src/types/LedgerTypes';

/**
 * The field readers the ledger reader is built out of.
 *
 * Each one takes a raw value and either returns it at the type the document says it has, or refuses the file. There is no
 * coercion anywhere: a number written as a string is not a number, a figure with a fraction in it is not an integer, and a
 * missing key is not an empty value. Being unable to coerce is the point — everything this application writes goes through the
 * writer, so anything these readers would have had to fix is a file it did not write.
 */

// Where a refusal is being raised, so that every helper can say it without being told twice
export interface LedgerFieldContext {
	entity: string;

	// Counting from 1, so that a refusal reads as a position in the file rather than an array offset
	position: number;

	// The record's own id, read off the raw record before any of it is validated, so that a refusal can name the row rather than
	// only count to it. Undefined when the record has no readable id, which is itself something the reader is about to refuse.
	recordId?: string;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// Every refusal raised on a field says the same things about where it was raised, and quotes back what the file held there
const refuseField: (context: LedgerFieldContext, reason: LedgerRefusalReason, field: string, value: unknown, enumName?: string) => never = (
	context,
	reason,
	field,
	value,
	enumName
) => {
	refuseLedger({
		reason,
		entity: context.entity,
		position: context.position,
		recordId: context.recordId,
		field,
		enumName,
		value: describeRefusedValue(value)
	});
};

/**
 * Reads one record, and refuses it for holding a key this version does not know or for lacking one it requires.
 * @param value The raw record.
 * @param allowedKeys Every key the record must have, and the only ones it may have.
 * @param context Where the refusal would be raised.
 * @returns The record, as a bag of raw values.
 */
export const readLedgerRecord = (value: unknown, allowedKeys: readonly string[], context: LedgerFieldContext): Record<string, unknown> => {
	if(typeof value !== 'object' || value === null || Array.isArray(value)) {
		refuseLedger({ reason: 'wrong-type', entity: context.entity, position: context.position, value: describeRefusedValue(value) });
	}

	const record = value as Record<string, unknown>;

	Object.keys(record).forEach((key) => {
		if(!allowedKeys.includes(key)) {
			refuseLedger({ reason: 'unknown-key', entity: context.entity, position: context.position, recordId: context.recordId, field: key });
		}
	});

	allowedKeys.forEach((key) => {
		if(!(key in record)) {
			refuseLedger({ reason: 'missing-key', entity: context.entity, position: context.position, recordId: context.recordId, field: key });
		}
	});

	return record;
};

/**
 * Reads an array of records off the document.
 * @param value The raw value the document held under that key.
 * @param entity The document's own key for the entity, used when refusing.
 * @returns The raw records.
 */
export const readLedgerArray = (value: unknown, entity: string): unknown[] => {
	if(!Array.isArray(value)) {
		refuseLedger({ reason: 'wrong-type', entity, field: entity, value: describeRefusedValue(value) });
	}

	return value;
};

export const readText = (record: Record<string, unknown>, field: string, context: LedgerFieldContext): string => {
	const value = record[field];

	if(typeof value !== 'string') {
		refuseField(context, 'wrong-type', field, value);
	}

	return value;
};

export const readNullableText = (record: Record<string, unknown>, field: string, context: LedgerFieldContext): string | null => {
	return record[field] === null ? null : readText(record, field, context);
};

export const readIdentifier = (record: Record<string, unknown>, field: string, context: LedgerFieldContext): LedgerId => {
	const value = readText(record, field, context);

	if(!value) {
		refuseField(context, 'wrong-type', field, value);
	}

	return value;
};

export const readNullableIdentifier = (record: Record<string, unknown>, field: string, context: LedgerFieldContext): LedgerId | null => {
	return record[field] === null ? null : readIdentifier(record, field, context);
};

export const readBoolean = (record: Record<string, unknown>, field: string, context: LedgerFieldContext): boolean => {
	const value = record[field];

	if(typeof value !== 'boolean') {
		refuseField(context, 'wrong-type', field, value);
	}

	return value;
};

/**
 * Reads a stored figure, which is always an integer in the minor units its field's scale fixes.
 * A figure carrying a fraction is refused exactly as an unknown key is: it is not silently rounded away.
 * @param record The raw record.
 * @param field The field to read.
 * @param context Where the refusal would be raised.
 * @returns The figure.
 */
export const readInteger = (record: Record<string, unknown>, field: string, context: LedgerFieldContext): number => {
	const value = record[field];

	if(typeof value !== 'number') {
		refuseField(context, 'wrong-type', field, value);
	}

	if(!Number.isSafeInteger(value)) {
		refuseField(context, 'non-integer-figure', field, value);
	}

	return value;
};

export const readNullableInteger = (record: Record<string, unknown>, field: string, context: LedgerFieldContext): number | null => {
	return record[field] === null ? null : readInteger(record, field, context);
};

/**
 * Checks that a string is a real day written as YYYY-MM-DD.
 * The components are compared back against the date they built, so that a 31st of February is refused rather than rolled forward.
 * @param value The stored text.
 * @returns Whether it names a day.
 */
export const isIsoDate = (value: string): boolean => {
	const match = ISO_DATE_PATTERN.exec(value);

	if(!match) {
		return false;
	}

	const [ , year, month, day ] = match;
	const date = new Date(Number(year), Number(month) - 1, Number(day));

	return date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day);
};

export const readDate = (record: Record<string, unknown>, field: string, context: LedgerFieldContext): IsoDate => {
	const value = readText(record, field, context);

	if(!isIsoDate(value)) {
		refuseField(context, 'malformed-date', field, value);
	}

	return value;
};

export const readNullableDate = (record: Record<string, unknown>, field: string, context: LedgerFieldContext): IsoDate | null => {
	return record[field] === null ? null : readDate(record, field, context);
};

/**
 * Reads a value out of one of the document's closed sets.
 * @param record The raw record.
 * @param field The field to read.
 * @param allowedValues The closed set.
 * @param enumName What that set is called, which is what a refusal names instead of the value it refused.
 * @param context Where the refusal would be raised.
 * @returns The value, at the union type of the set.
 */
export const readEnum = <TValue extends string>(
	record: Record<string, unknown>,
	field: string,
	allowedValues: readonly TValue[],
	enumName: string,
	context: LedgerFieldContext
): TValue => {
	const value = readText(record, field, context);

	if(!allowedValues.includes(value as TValue)) {
		refuseField(context, 'unknown-enum-value', field, value, enumName);
	}

	return value as TValue;
};

export const readNullableEnum = <TValue extends string>(
	record: Record<string, unknown>,
	field: string,
	allowedValues: readonly TValue[],
	enumName: string,
	context: LedgerFieldContext
): TValue | null => {
	return record[field] === null ? null : readEnum(record, field, allowedValues, enumName, context);
};
