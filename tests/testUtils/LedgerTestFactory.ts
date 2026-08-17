import { createSeededLedgerDocument } from 'src/logic/ledger/LedgerDocument';
import { writeLedgerDocument } from 'src/logic/ledger/LedgerWriter';
import { createSpiccioliTranslator } from 'src/i18n/Translations';
import type {
	Account,
	Category,
	Contract,
	ContractYear,
	Institution,
	LedgerDocument,
	Payslip,
	Price,
	Rule,
	Security,
	Trade,
	Transaction
} from 'src/types/LedgerTypes';

/**
 * Records for the storage tests, at the scales the file stores them in.
 * Every figure here is already in minor units, exactly as the file holds it, so a test that reads a figure back is comparing
 * against the same integer the writer put in.
 */

export const makeSeededDocument = (): LedgerDocument => {
	return createSeededLedgerDocument(createSpiccioliTranslator('en'));
};

export const makeInstitution = (overrides: Partial<Institution> = {}): Institution => {
	return {
		id: 'institution-1',
		name: 'Fineco',
		defaultSellFee: 295,
		notes: '',
		...overrides
	};
};

export const makeAccount = (overrides: Partial<Account> = {}): Account => {
	return {
		id: 'account-1',
		name: 'Conto Corrente',
		institutionId: 'institution-1',
		type: 'current-account',
		openingBalance: 100000,
		exitTaxRate: null,
		openingDate: '2016-01-01',
		closingDate: null,
		notes: '',
		...overrides
	};
};

export const makeSecurity = (overrides: Partial<Security> = {}): Security => {
	return {
		id: 'security-1',
		isin: 'IE00B4L5Y983',
		ticker: 'SWDA',
		exchange: 'milan',
		name: 'iShares Core MSCI World',
		type: 'stock-etf',
		taxRate: 2600,
		notes: '',
		...overrides
	};
};

export const makePrice = (overrides: Partial<Price> = {}): Price => {
	return {
		securityId: 'security-1',
		date: '2026-08-08',
		value: 1054300,
		source: 'manual',
		...overrides
	};
};

export const makeTransaction = (overrides: Partial<Transaction> = {}): Transaction => {
	return {
		id: 'transaction-1',
		accountId: 'account-1',
		date: '2026-08-08',
		description: 'ESSELUNGA MILANO',
		amount: -4250,
		categoryId: 'groceries',
		categorySource: 'automatic',
		receiptState: 'na',
		notes: '',
		insertionSeq: 1,
		...overrides
	};
};

export const makeTrade = (overrides: Partial<Trade> = {}): Trade => {
	return {
		id: 'trade-1',
		kind: 'purchase',
		securityId: 'security-1',
		accountId: 'account-2',
		date: '2026-08-08',
		quantity: 125000,
		unitPrice: 1054300,
		fees: 295,
		taxes: 0,
		notes: '',
		insertionSeq: 1,
		...overrides
	};
};

export const makeContract = (overrides: Partial<Contract> = {}): Contract => {
	return {
		id: 'contract-1',
		name: 'Employer',
		monthsPerYear: 13,
		hoursPerDay: 800,
		startDate: '2016-01-01',
		endDate: null,
		notes: '',
		...overrides
	};
};

export const makeContractYear = (overrides: Partial<ContractYear> = {}): ContractYear => {
	return {
		contractId: 'contract-1',
		year: 2026,
		workingDays: 252,
		...overrides
	};
};

export const makePayslip = (overrides: Partial<Payslip> = {}): Payslip => {
	return {
		id: 'payslip-1',
		contractId: 'contract-1',
		year: 2026,
		month: 7,
		label: null,
		contractGross: 300000,
		gross: 320000,
		netPayment: 210000,
		refunds: 0,
		carPayment: 0,
		employeeContribution: 5000,
		employerContribution: 5000,
		severanceContribution: 20000,
		notes: '',
		...overrides
	};
};

export const makeRule = (overrides: Partial<Rule> = {}): Rule => {
	return {
		id: 'rule-1',
		order: 1,
		substring: 'ESSELUNGA',
		categoryId: 'groceries',
		...overrides
	};
};

/**
 * A seeded document with one of everything in it, so that a round trip covers every entity at once.
 * @returns The document.
 */
export const makeFullDocument = (): LedgerDocument => {
	const document = makeSeededDocument();
	const brokerageAccount = makeAccount({ id: 'account-2', name: 'Titoli', type: 'brokerage', openingBalance: 0 });

	return {
		...document,
		institutions: [ makeInstitution() ],
		accounts: [ makeAccount(), brokerageAccount ],
		securities: [ makeSecurity() ],
		prices: [ makePrice() ],
		transactions: [ makeTransaction() ],
		trades: [ makeTrade() ],
		contracts: [ makeContract() ],
		contractYears: [ makeContractYear() ],
		payslips: [ makePayslip() ],
		rules: [ makeRule() ]
	};
};

// The parsed form of a document, so that a test can change one key and see what the reader makes of it
export const makeRawDocument = (mutate: (raw: Record<string, unknown>) => void = () => {
	return undefined;
}): Record<string, unknown> => {
	const raw = JSON.parse(writeLedgerDocument(makeFullDocument())) as Record<string, unknown>;
	mutate(raw);

	return raw;
};

export const makeCategory = (overrides: Partial<Category> = {}): Category => {
	return {
		id: 'groceries',
		name: 'Groceries',
		type: 'expense',
		role: null,
		receiptTracked: false,
		order: 9,
		...overrides
	};
};
