import type { SpiccioliTranslationKey, SpiccioliTranslator } from 'src/i18n/Translations';
import type { Formatter } from 'src/logic/format/Formatter';
import type { LedgerRefusal, LedgerRefusalReason } from 'src/logic/ledger/LedgerRefusal';
import type { LedgerEntityKey } from 'src/types/LedgerTypes';

/**
 * Turns a refusal into the sentences the launch screen shows.
 *
 * The reader states what it did not understand in fields; this is where those fields become wording. It takes a translator and
 * a formatter rather than reaching for either, so that it stays pure and testable — and the formatter is what makes a position
 * carry the separators the preferences fix rather than the ones a locale would pick.
 *
 * **What it says is where, what and which value**: the record's own id so the row can be searched for, the position counted in
 * records of that entity rather than in lines of the file, and the value the file held there. That value is shown here and
 * never logged — the log is handed "redactLedgerRefusal" of the same refusal.
 */

const REASON_KEYS: Record<LedgerRefusalReason, SpiccioliTranslationKey> = {
	'malformed-json': 'refusal.reason.malformedJson',
	'wrong-type': 'refusal.reason.wrongType',
	'unknown-key': 'refusal.reason.unknownKey',
	'missing-key': 'refusal.reason.missingKey',
	'unknown-enum-value': 'refusal.reason.unknownEnumValue',
	'unknown-category': 'refusal.reason.unknownCategory',
	'non-integer-figure': 'refusal.reason.nonIntegerFigure',
	'malformed-date': 'refusal.reason.malformedDate',
	'duplicate-key': 'refusal.reason.duplicateKey',
	'dangling-reference': 'refusal.reason.danglingReference',
	'unsupported-schema-version': 'refusal.reason.unsupportedSchemaVersion'
};

// Also what a screen listing the entities reads, so that an entity is named in one place rather than in each of them
export const LEDGER_ENTITY_NAME_KEYS: Record<LedgerEntityKey, SpiccioliTranslationKey> = {
	institutions: 'refusal.entity.institutions',
	accounts: 'refusal.entity.accounts',
	securities: 'refusal.entity.securities',
	prices: 'refusal.entity.prices',
	transactions: 'refusal.entity.transactions',
	trades: 'refusal.entity.trades',
	contracts: 'refusal.entity.contracts',
	contractYears: 'refusal.entity.contractYears',
	payslips: 'refusal.entity.payslips',
	categories: 'refusal.entity.categories',
	rules: 'refusal.entity.rules'
};

// The same eleven named one at a time, because a refusal is raised on one record
const LEDGER_ENTITY_SINGULAR_KEYS: Record<LedgerEntityKey, SpiccioliTranslationKey> = {
	institutions: 'refusal.entitySingular.institutions',
	accounts: 'refusal.entitySingular.accounts',
	securities: 'refusal.entitySingular.securities',
	prices: 'refusal.entitySingular.prices',
	transactions: 'refusal.entitySingular.transactions',
	trades: 'refusal.entitySingular.trades',
	contracts: 'refusal.entitySingular.contracts',
	contractYears: 'refusal.entitySingular.contractYears',
	payslips: 'refusal.entitySingular.payslips',
	categories: 'refusal.entitySingular.categories',
	rules: 'refusal.entitySingular.rules'
};

// A position is written the way the language writes an ordinal, and which suffix it takes is the language's rule and not this
// module's: the translator picks the category and the bundle holds the four wordings
const ORDINAL_KEYS: Record<Intl.LDMLPluralRule, SpiccioliTranslationKey> = {
	zero: 'refusal.ordinalOther',
	one: 'refusal.ordinalOne',
	two: 'refusal.ordinalTwo',
	few: 'refusal.ordinalFew',
	many: 'refusal.ordinalOther',
	other: 'refusal.ordinalOther'
};

const isEntityKey = (entity: string | undefined): entity is LedgerEntityKey => {
	return entity !== undefined && entity in LEDGER_ENTITY_NAME_KEYS;
};

// The position, grouped with the separators in force and given the suffix its own number takes: "2.857th", never "2,857th"
const describePosition = (position: number, translator: SpiccioliTranslator, formatter: Formatter): string => {
	return translator.t(ORDINAL_KEYS[translator.selectOrdinal(position)], { position: formatter.integer(position) });
};

/**
 * Says where the refusal was raised, as precisely as what the reader had at that moment allows.
 * A record names itself by its id wherever it has one; the whole file is what is left when the refusal was raised before any
 * record was reached at all.
 * @param refusal What the reader refused, and where.
 * @param translator The wording.
 * @param formatter The separators in force.
 * @returns The place, as a fragment the sentences below drop into.
 */
const describeLocation = (refusal: LedgerRefusal, translator: SpiccioliTranslator, formatter: Formatter): string => {
	if(!isEntityKey(refusal.entity)) {
		return translator.t('refusal.locationFile');
	}

	if(refusal.position === undefined) {
		return translator.t('refusal.locationList', { entity: translator.t(LEDGER_ENTITY_NAME_KEYS[refusal.entity]) });
	}

	const parameters = {
		position: describePosition(refusal.position, translator, formatter),
		entity: translator.t(LEDGER_ENTITY_SINGULAR_KEYS[refusal.entity]),
		recordId: refusal.recordId ?? ''
	};

	return translator.t(refusal.recordId === undefined ? 'refusal.locationRecord' : 'refusal.locationRecordWithId', parameters);
};

/**
 * Builds what the user is told about a file that was not understood.
 * @param refusal What the reader refused, and where.
 * @param translator The wording.
 * @param formatter The separators in force, which is what writes the position.
 * @returns What was not understood, and the value it was raised on where there was one.
 */
export const describeLedgerRefusal = (refusal: LedgerRefusal, translator: SpiccioliTranslator, formatter: Formatter): string => {
	const reason = translator.t(REASON_KEYS[refusal.reason], {
		location: describeLocation(refusal, translator, formatter),
		field: refusal.field ?? '',
		enumName: refusal.enumName ?? '',

		// A schema version names a shape rather than counting anything, so it is written as it stands and never grouped
		foundSchemaVersion: String(refusal.foundSchemaVersion ?? 0),
		supportedSchemaVersion: String(refusal.supportedSchemaVersion ?? 0)
	});

	if(refusal.value === undefined) {
		return reason;
	}

	return `${reason} ${translator.t('refusal.foundValue', { value: refusal.value })}`;
};
