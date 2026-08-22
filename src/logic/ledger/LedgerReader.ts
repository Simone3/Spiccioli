import { LEDGER_SCHEMA_VERSION } from 'src/logic/ledger/LedgerDocument';
import {
	readBoolean,
	readDate,
	readEnum,
	readIdentifier,
	readInteger,
	readLedgerArray,
	readLedgerRecord,
	readNullableDate,
	readNullableEnum,
	readNullableIdentifier,
	readNullableInteger,
	readNullableText,
	readText,
	type LedgerFieldContext
} from 'src/logic/ledger/LedgerFields';
import { describeRefusedValue, isLedgerRefusalError, refuseLedger, type LedgerRefusal } from 'src/logic/ledger/LedgerRefusal';
import { SEEDED_CATEGORY_IDS } from 'src/logic/ledger/SeededCategories';
import {
	ACCOUNT_TYPES,
	CATEGORY_ROLES,
	CATEGORY_SOURCES,
	CATEGORY_TYPES,
	EXCHANGES,
	LEDGER_ENTITY_KEYS,
	PRICE_SOURCES,
	RECEIPT_STATES,
	SECURITY_TYPES,
	TRADE_KINDS,
	type Account,
	type Category,
	type Contract,
	type ContractYear,
	type Institution,
	type LedgerDocument,
	type LedgerId,
	type Payslip,
	type Price,
	type Rule,
	type Security,
	type Trade,
	type Transaction
} from 'src/types/LedgerTypes';

/**
 * Bytes in, model out. The reader is pure: it knows nothing about a filesystem, and storage hands it a string.
 *
 * **It validates exhaustively, and that is the whole design.** A file at a later schema version, a file carrying a key or an
 * enum value this version has never heard of, a category this version does not seed, a reference to a record that is not there,
 * or a figure with a fraction of a cent in it — every one of those is a file this application did not write, and it is refused
 * with a statement of what was not understood rather than opened with the unrecognised part ignored. There is no read-only mode
 * and there is no "best effort" path.
 *
 * A file at an **earlier** version is not an error: it is handed back for the upgrade of "LedgerUpgrade.ts" to convert, with the
 * user's consent, and validated afterwards like any other document.
 */

export type LedgerReadResult = {
	outcome: 'read';
	document: LedgerDocument;
} | {
	outcome: 'upgrade-required';

	// The parsed file, still in the shape the older version wrote it in. Only the upgrade may look at it.
	rawDocument: unknown;
	fromSchemaVersion: number;
	toSchemaVersion: number;
} | {
	outcome: 'refused';
	refusal: LedgerRefusal;
};

const INSTITUTION_KEYS = [ 'id', 'name', 'defaultSellFee', 'notes' ] as const;

const ACCOUNT_KEYS = [ 'id', 'name', 'institutionId', 'type', 'openingBalance', 'exitTaxRate', 'openingDate', 'closingDate', 'notes' ] as const;

const SECURITY_KEYS = [ 'id', 'isin', 'ticker', 'exchange', 'name', 'type', 'taxRate', 'notes' ] as const;

const PRICE_KEYS = [ 'securityId', 'date', 'value', 'source' ] as const;

const TRANSACTION_KEYS = [ 'id', 'accountId', 'date', 'description', 'amount', 'categoryId', 'categorySource', 'receiptState', 'notes', 'insertionSeq' ] as const;

const TRADE_KEYS = [ 'id', 'kind', 'securityId', 'accountId', 'date', 'quantity', 'unitPrice', 'fees', 'taxes', 'notes', 'insertionSeq' ] as const;

const CONTRACT_KEYS = [ 'id', 'name', 'monthsPerYear', 'hoursPerDay', 'startDate', 'endDate', 'notes' ] as const;

const CONTRACT_YEAR_KEYS = [ 'contractId', 'year', 'workingDays' ] as const;

const PAYSLIP_KEYS = [
	'id',
	'contractId',
	'year',
	'month',
	'label',
	'contractGross',
	'gross',
	'netPayment',
	'refunds',
	'carPayment',
	'employeeContribution',
	'employerContribution',
	'severanceContribution',
	'notes'
] as const;

const CATEGORY_KEYS = [ 'id', 'name', 'type', 'role', 'receiptTracked', 'order' ] as const;

const RULE_KEYS = [ 'id', 'order', 'substring', 'categoryId' ] as const;

const DOCUMENT_KEYS: readonly string[] = [ 'schemaVersion', ...LEDGER_ENTITY_KEYS ];

const ENTITY_KEYS: Record<string, readonly string[]> = {
	institutions: INSTITUTION_KEYS,
	accounts: ACCOUNT_KEYS,
	securities: SECURITY_KEYS,
	prices: PRICE_KEYS,
	transactions: TRANSACTION_KEYS,
	trades: TRADE_KEYS,
	contracts: CONTRACT_KEYS,
	contractYears: CONTRACT_YEAR_KEYS,
	payslips: PAYSLIP_KEYS,
	categories: CATEGORY_KEYS,
	rules: RULE_KEYS
};

// What names one record of an entity. Everything is keyed by an id except the two keyed by a pair, and those two are named by
// the pair, so that a refusal on one of them can be found in the file as readily as a refusal on any other.
const IDENTITY_KEYS: Record<string, readonly string[]> = {
	prices: [ 'securityId', 'date' ],
	contractYears: [ 'contractId', 'year' ]
};

const DEFAULT_IDENTITY_KEYS: readonly string[] = [ 'id' ];

// Joins a composite key into the one string a refusal names the record by, which is also what tells two records apart below
const joinIdentity = (parts: readonly (string | number)[]): string => {
	return parts.join(' + ');
};

// The record's own id, read off the raw record before anything about it has been validated: a refusal is worth far more for
// naming the row than for counting to it, and by the time a field is refused there is no validated record left to ask.
const readIdentity = (rawRecord: unknown, entity: string): string | undefined => {
	if(typeof rawRecord !== 'object' || rawRecord === null || Array.isArray(rawRecord)) {
		return undefined;
	}

	const record = rawRecord as Record<string, unknown>;
	const parts = (IDENTITY_KEYS[entity] ?? DEFAULT_IDENTITY_KEYS).map((key) => {
		return record[key];
	});

	if(!parts.every((part): part is string | number => {
		return typeof part === 'string' || typeof part === 'number';
	})) {
		return undefined;
	}

	return joinIdentity(parts);
};

// Reads every record of one entity, giving each its position in the file and its own id so that a refusal can point at the row
// it was raised on
const readEntity = <TRecord>(
	rawDocument: Record<string, unknown>,
	entity: string,
	readRecord: (record: Record<string, unknown>, context: LedgerFieldContext) => TRecord
): TRecord[] => {
	return readLedgerArray(rawDocument[entity], entity).map((rawRecord, index) => {
		const context: LedgerFieldContext = { entity, position: index + 1, recordId: readIdentity(rawRecord, entity) };

		return readRecord(readLedgerRecord(rawRecord, ENTITY_KEYS[entity], context), context);
	});
};

const readInstitution = (record: Record<string, unknown>, context: LedgerFieldContext): Institution => {
	return {
		id: readIdentifier(record, 'id', context),
		name: readText(record, 'name', context),
		defaultSellFee: readInteger(record, 'defaultSellFee', context),
		notes: readText(record, 'notes', context)
	};
};

const readAccount = (record: Record<string, unknown>, context: LedgerFieldContext): Account => {
	return {
		id: readIdentifier(record, 'id', context),
		name: readText(record, 'name', context),
		institutionId: readNullableIdentifier(record, 'institutionId', context),
		type: readEnum(record, 'type', ACCOUNT_TYPES, 'AccountType', context),
		openingBalance: readInteger(record, 'openingBalance', context),
		exitTaxRate: readNullableInteger(record, 'exitTaxRate', context),
		openingDate: readDate(record, 'openingDate', context),
		closingDate: readNullableDate(record, 'closingDate', context),
		notes: readText(record, 'notes', context)
	};
};

const readSecurity = (record: Record<string, unknown>, context: LedgerFieldContext): Security => {
	return {
		id: readIdentifier(record, 'id', context),
		isin: readText(record, 'isin', context),
		ticker: readText(record, 'ticker', context),
		exchange: readEnum(record, 'exchange', EXCHANGES, 'Exchange', context),
		name: readText(record, 'name', context),
		type: readEnum(record, 'type', SECURITY_TYPES, 'SecurityType', context),
		taxRate: readInteger(record, 'taxRate', context),
		notes: readText(record, 'notes', context)
	};
};

const readPrice = (record: Record<string, unknown>, context: LedgerFieldContext): Price => {
	return {
		securityId: readIdentifier(record, 'securityId', context),
		date: readDate(record, 'date', context),
		value: readInteger(record, 'value', context),
		source: readEnum(record, 'source', PRICE_SOURCES, 'PriceSource', context)
	};
};

const readTransaction = (record: Record<string, unknown>, context: LedgerFieldContext): Transaction => {
	return {
		id: readIdentifier(record, 'id', context),
		accountId: readIdentifier(record, 'accountId', context),
		date: readDate(record, 'date', context),
		description: readText(record, 'description', context),
		amount: readInteger(record, 'amount', context),
		categoryId: readNullableIdentifier(record, 'categoryId', context),
		categorySource: readEnum(record, 'categorySource', CATEGORY_SOURCES, 'CategorySource', context),
		receiptState: readEnum(record, 'receiptState', RECEIPT_STATES, 'ReceiptState', context),
		notes: readText(record, 'notes', context),
		insertionSeq: readInteger(record, 'insertionSeq', context)
	};
};

const readTrade = (record: Record<string, unknown>, context: LedgerFieldContext): Trade => {
	return {
		id: readIdentifier(record, 'id', context),
		kind: readEnum(record, 'kind', TRADE_KINDS, 'TradeKind', context),
		securityId: readIdentifier(record, 'securityId', context),
		accountId: readIdentifier(record, 'accountId', context),
		date: readDate(record, 'date', context),
		quantity: readInteger(record, 'quantity', context),
		unitPrice: readInteger(record, 'unitPrice', context),
		fees: readInteger(record, 'fees', context),
		taxes: readInteger(record, 'taxes', context),
		notes: readText(record, 'notes', context),
		insertionSeq: readInteger(record, 'insertionSeq', context)
	};
};

const readContract = (record: Record<string, unknown>, context: LedgerFieldContext): Contract => {
	return {
		id: readIdentifier(record, 'id', context),
		name: readText(record, 'name', context),
		monthsPerYear: readInteger(record, 'monthsPerYear', context),
		hoursPerDay: readInteger(record, 'hoursPerDay', context),
		startDate: readDate(record, 'startDate', context),
		endDate: readNullableDate(record, 'endDate', context),
		notes: readText(record, 'notes', context)
	};
};

const readContractYear = (record: Record<string, unknown>, context: LedgerFieldContext): ContractYear => {
	return {
		contractId: readIdentifier(record, 'contractId', context),
		year: readInteger(record, 'year', context),
		workingDays: readInteger(record, 'workingDays', context)
	};
};

const readPayslip = (record: Record<string, unknown>, context: LedgerFieldContext): Payslip => {
	return {
		id: readIdentifier(record, 'id', context),
		contractId: readIdentifier(record, 'contractId', context),
		year: readInteger(record, 'year', context),
		month: readInteger(record, 'month', context),
		label: readNullableText(record, 'label', context),
		contractGross: readInteger(record, 'contractGross', context),
		gross: readInteger(record, 'gross', context),
		netPayment: readInteger(record, 'netPayment', context),
		refunds: readInteger(record, 'refunds', context),
		carPayment: readInteger(record, 'carPayment', context),
		employeeContribution: readInteger(record, 'employeeContribution', context),
		employerContribution: readInteger(record, 'employerContribution', context),
		severanceContribution: readInteger(record, 'severanceContribution', context),
		notes: readText(record, 'notes', context)
	};
};

// A category this version does not seed is the "unknown category" the specification refuses a file for: the list is fixed in
// code, so an id that is not on it names something this build has no taxonomy for
const readCategory = (record: Record<string, unknown>, context: LedgerFieldContext): Category => {
	const id = readIdentifier(record, 'id', context);

	if(!SEEDED_CATEGORY_IDS.has(id)) {
		refuseLedger({ reason: 'unknown-category', entity: context.entity, position: context.position, recordId: id, field: 'id' });
	}

	return {
		id,
		name: readText(record, 'name', context),
		type: readEnum(record, 'type', CATEGORY_TYPES, 'CategoryType', context),
		role: readNullableEnum(record, 'role', CATEGORY_ROLES, 'CategoryRole', context),
		receiptTracked: readBoolean(record, 'receiptTracked', context),
		order: readInteger(record, 'order', context)
	};
};

const readRule = (record: Record<string, unknown>, context: LedgerFieldContext): Rule => {
	return {
		id: readIdentifier(record, 'id', context),
		order: readInteger(record, 'order', context),
		substring: readText(record, 'substring', context),
		categoryId: readIdentifier(record, 'categoryId', context)
	};
};

// Two records that cannot be told apart are as unreadable as a key nobody recognises: whichever of them a reference meant, the
// file does not say
const collectIdentities = (entity: string, keys: readonly string[]): Set<string> => {
	const identities = new Set<string>();

	keys.forEach((key, index) => {
		if(identities.has(key)) {
			refuseLedger({ reason: 'duplicate-key', entity, position: index + 1, recordId: key });
		}

		identities.add(key);
	});

	return identities;
};

const requireReference = (identities: ReadonlySet<LedgerId>, reference: LedgerId | null, context: LedgerFieldContext, field: string): void => {
	if(reference !== null && !identities.has(reference)) {
		refuseLedger({
			reason: 'dangling-reference',
			entity: context.entity,
			position: context.position,
			recordId: context.recordId,
			field,
			value: describeRefusedValue(reference)
		});
	}
};

// Nothing in the file may point at a record it does not hold. It is the rule an upgrade is held to as well: a transaction left
// pointing at a category that was retired would make the next open refuse the file the upgrade had just written.
const validateReferences = (document: LedgerDocument): void => {
	const institutionIds = collectIdentities('institutions', document.institutions.map((institution) => {
		return institution.id;
	}));
	const accountIds = collectIdentities('accounts', document.accounts.map((account) => {
		return account.id;
	}));
	const securityIds = collectIdentities('securities', document.securities.map((security) => {
		return security.id;
	}));
	const contractIds = collectIdentities('contracts', document.contracts.map((contract) => {
		return contract.id;
	}));
	const categoryIds = collectIdentities('categories', document.categories.map((category) => {
		return category.id;
	}));

	collectIdentities('transactions', document.transactions.map((transaction) => {
		return transaction.id;
	}));
	collectIdentities('trades', document.trades.map((trade) => {
		return trade.id;
	}));
	collectIdentities('payslips', document.payslips.map((payslip) => {
		return payslip.id;
	}));
	collectIdentities('rules', document.rules.map((rule) => {
		return rule.id;
	}));

	// The two entities keyed by something other than an id: one price per security per day, and one record per contract and year
	collectIdentities('prices', document.prices.map((price) => {
		return joinIdentity([ price.securityId, price.date ]);
	}));
	collectIdentities('contractYears', document.contractYears.map((contractYear) => {
		return joinIdentity([ contractYear.contractId, contractYear.year ]);
	}));

	document.accounts.forEach((account, index) => {
		requireReference(institutionIds, account.institutionId, { entity: 'accounts', position: index + 1, recordId: account.id }, 'institutionId');
	});
	document.prices.forEach((price, index) => {
		const context: LedgerFieldContext = { entity: 'prices', position: index + 1, recordId: joinIdentity([ price.securityId, price.date ]) };

		requireReference(securityIds, price.securityId, context, 'securityId');
	});
	document.transactions.forEach((transaction, index) => {
		const context: LedgerFieldContext = { entity: 'transactions', position: index + 1, recordId: transaction.id };

		requireReference(accountIds, transaction.accountId, context, 'accountId');
		requireReference(categoryIds, transaction.categoryId, context, 'categoryId');
	});
	document.trades.forEach((trade, index) => {
		const context: LedgerFieldContext = { entity: 'trades', position: index + 1, recordId: trade.id };

		requireReference(securityIds, trade.securityId, context, 'securityId');
		requireReference(accountIds, trade.accountId, context, 'accountId');
	});
	document.contractYears.forEach((contractYear, index) => {
		const context: LedgerFieldContext = {
			entity: 'contractYears',
			position: index + 1,
			recordId: joinIdentity([ contractYear.contractId, contractYear.year ])
		};

		requireReference(contractIds, contractYear.contractId, context, 'contractId');
	});
	document.payslips.forEach((payslip, index) => {
		requireReference(contractIds, payslip.contractId, { entity: 'payslips', position: index + 1, recordId: payslip.id }, 'contractId');
	});
	document.rules.forEach((rule, index) => {
		requireReference(categoryIds, rule.categoryId, { entity: 'rules', position: index + 1, recordId: rule.id }, 'categoryId');
	});
};

const readDocumentShell = (rawDocument: unknown): Record<string, unknown> => {
	if(typeof rawDocument !== 'object' || rawDocument === null || Array.isArray(rawDocument)) {
		refuseLedger({ reason: 'wrong-type', value: describeRefusedValue(rawDocument) });
	}

	const record = rawDocument as Record<string, unknown>;

	Object.keys(record).forEach((key) => {
		if(!DOCUMENT_KEYS.includes(key)) {
			refuseLedger({ reason: 'unknown-key', field: key });
		}
	});

	DOCUMENT_KEYS.forEach((key) => {
		if(!(key in record)) {
			refuseLedger({ reason: 'missing-key', field: key });
		}
	});

	return record;
};

/**
 * Turns an already parsed document at the current schema version into the model.
 * The upgrade calls this after converting an older file, which is what makes an upgrade unable to write a file the next open would refuse.
 * @param rawDocument The parsed file.
 * @returns The document.
 */
export const validateLedgerDocument = (rawDocument: unknown): LedgerDocument => {
	const record = readDocumentShell(rawDocument);
	const document: LedgerDocument = {
		schemaVersion: readInteger(record, 'schemaVersion', { entity: 'document', position: 1 }),
		institutions: readEntity(record, 'institutions', readInstitution),
		accounts: readEntity(record, 'accounts', readAccount),
		securities: readEntity(record, 'securities', readSecurity),
		prices: readEntity(record, 'prices', readPrice),
		transactions: readEntity(record, 'transactions', readTransaction),
		trades: readEntity(record, 'trades', readTrade),
		contracts: readEntity(record, 'contracts', readContract),
		contractYears: readEntity(record, 'contractYears', readContractYear),
		payslips: readEntity(record, 'payslips', readPayslip),
		categories: readEntity(record, 'categories', readCategory),
		rules: readEntity(record, 'rules', readRule)
	};

	validateReferences(document);

	return document;
};

// The version is read before anything else, because it is what decides whether the rest of the file is a shape this build knows
const readSchemaVersion = (rawDocument: unknown): number => {
	if(typeof rawDocument !== 'object' || rawDocument === null || Array.isArray(rawDocument)) {
		refuseLedger({ reason: 'wrong-type', value: describeRefusedValue(rawDocument) });
	}

	const version = (rawDocument as Record<string, unknown>).schemaVersion;

	if(typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) {
		refuseLedger({ reason: 'wrong-type', field: 'schemaVersion', value: describeRefusedValue(version) });
	}

	return version;
};

/**
 * Reads a ledger file.
 * @param contents The whole file, as text.
 * @param supportedSchemaVersion The version this build reads. Only the tests ever pass another one, so that the three positions
 * a file can be at relative to the application can each be exercised while there is still only one version in existence.
 * @returns The document, the fact that it has to be upgraded first, or what was not understood about it.
 */
export const readLedgerDocument = (contents: string, supportedSchemaVersion: number = LEDGER_SCHEMA_VERSION): LedgerReadResult => {
	try {
		let rawDocument: unknown;

		try {
			rawDocument = JSON.parse(contents);
		}
		catch {
			refuseLedger({ reason: 'malformed-json' });
		}

		const schemaVersion = readSchemaVersion(rawDocument);

		// A file written by a later version holds keys, values and meanings this build has never heard of, and no amount of
		// validation here could tell which of them mattered
		if(schemaVersion > supportedSchemaVersion) {
			refuseLedger({
				reason: 'unsupported-schema-version',
				foundSchemaVersion: schemaVersion,
				supportedSchemaVersion
			});
		}

		if(schemaVersion < supportedSchemaVersion) {
			return {
				outcome: 'upgrade-required',
				rawDocument,
				fromSchemaVersion: schemaVersion,
				toSchemaVersion: supportedSchemaVersion
			};
		}

		return {
			outcome: 'read',
			document: validateLedgerDocument(rawDocument)
		};
	}
	catch(error) {
		if(isLedgerRefusalError(error)) {
			return {
				outcome: 'refused',
				refusal: error.refusal
			};
		}

		throw error;
	}
};
