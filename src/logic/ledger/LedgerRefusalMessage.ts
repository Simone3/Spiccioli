import type { SpiccioliTranslationKey, SpiccioliTranslator } from 'src/i18n/Translations';
import type { LedgerRefusal, LedgerRefusalReason } from 'src/logic/ledger/LedgerRefusal';
import type { LedgerEntityKey } from 'src/types/LedgerTypes';

/**
 * Turns a refusal into the sentence the launch screen shows.
 *
 * The reader states what it did not understand in fields; this is where those fields become wording. It takes a translator
 * rather than reaching for one, so that it stays pure and testable, and it never has a value to print — a refusal carries the
 * place and the reason and never the figure or the text it was raised on.
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

const describeEntity = (translator: SpiccioliTranslator, entity: string | undefined): string | undefined => {
	const key = entity === undefined ? undefined : LEDGER_ENTITY_NAME_KEYS[entity as LedgerEntityKey];

	return key ? translator.t(key) : entity;
};

/**
 * Builds the sentence that says what was not understood about a file.
 * @param refusal What the reader refused, and where.
 * @param translator The wording.
 * @returns One sentence, ready to be shown.
 */
export const describeLedgerRefusal = (refusal: LedgerRefusal, translator: SpiccioliTranslator): string => {
	const entity = describeEntity(translator, refusal.entity);
	const location = entity && refusal.position !== undefined ?
		translator.t('refusal.locationRow', { entity, position: refusal.position }) :
		entity ?? translator.t('refusal.locationFile');

	return translator.t(REASON_KEYS[refusal.reason], {
		location,
		field: refusal.field ?? '',
		enumName: refusal.enumName ?? '',
		foundSchemaVersion: refusal.foundSchemaVersion ?? 0,
		supportedSchemaVersion: refusal.supportedSchemaVersion ?? 0
	});
};
