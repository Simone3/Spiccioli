import { createSeededCategories } from 'src/logic/ledger/SeededCategories';
import type { SpiccioliTranslator } from 'src/i18n/Translations';
import type { LedgerDocument, LedgerId } from 'src/types/LedgerTypes';

/**
 * The document itself: which schema version this build writes, what a brand new file holds, and the two identity rules every
 * record obeys.
 *
 * Nothing here touches a filesystem. The document is bytes in and bytes out, and where those bytes come from is storage's problem.
 */

/**
 * The one integer that says which shape a file is in. It goes up by one every time the shape changes, and the upgrade that
 * takes a file from the version before it to this one is registered in "LedgerUpgrade.ts".
 *
 * A file at a **later** version is refused: this build cannot know what was added after it. A file at an **earlier** one is
 * upgraded, once, with the user's consent.
 */
export const LEDGER_SCHEMA_VERSION = 1;

/**
 * Creates the identity of a new record.
 * An id is never shown and never parsed: it exists so that one record can point at another, and nothing else reads it.
 * @returns A fresh identifier.
 */
export const createLedgerId = (): LedgerId => {
	return crypto.randomUUID();
};

/**
 * Works out the next insertion sequence for an entity.
 *
 * The sequence is monotonic **per entity** — transactions and trades count separately — and a value is never reused, which is
 * why it is taken from the highest one present rather than from how many records there are. Deleting the last transaction and
 * adding another must not put the new one where the deleted one sat in the ordering.
 * @param records The records of one entity, in any order.
 * @returns The sequence the next record of that entity takes.
 */
export const nextInsertionSeq = (records: readonly { insertionSeq: number }[]): number => {
	return records.reduce((highest, record) => {
		return Math.max(highest, record.insertionSeq);
	}, 0) + 1;
};

/**
 * Builds the document a new file is written with: the twenty-seven categories, and nothing else at all.
 * @param translator The wording the seeded category names are copied from.
 * @returns A document at the current schema version.
 */
export const createSeededLedgerDocument = (translator: SpiccioliTranslator): LedgerDocument => {
	return {
		schemaVersion: LEDGER_SCHEMA_VERSION,
		institutions: [],
		accounts: [],
		securities: [],
		prices: [],
		transactions: [],
		trades: [],
		contracts: [],
		contractYears: [],
		payslips: [],
		categories: createSeededCategories(translator),
		rules: []
	};
};
