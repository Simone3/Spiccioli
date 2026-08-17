/**
 * The eleven stored entities of the functional analysis, the closed sets their enum fields take, and the document that holds them.
 *
 * Two rules run through every type here and neither has an exception.
 *
 * **Every stored number is an integer**, at the scale its field fixes: amounts in cents, quantities, unit prices and rates in
 * ten-thousandths, `hoursPerDay` in hundredths, and the counts as they are. A fractional figure is not a number this application
 * ever wrote, and the reader refuses one. The arithmetic that goes with the scales is in "src/logic/money/Money.ts".
 *
 * **Every key is present in the file**, and a value that is not there is written as `null` rather than left out. That is what lets
 * the reader be exhaustive in both directions: an unknown key is a file this version does not understand, and so is a missing one.
 */

// The identity of a record, and the only thing that is never shown to the user
export type LedgerId = string;

// A day, as "YYYY-MM-DD". There is no time and no time zone anywhere in the file.
export type IsoDate = string;

// A monetary figure, in cents. Two decimal places.
export type Cents = number;

// A quantity, a unit price or a rate, in ten-thousandths. Four decimal places.
export type TenThousandths = number;

// A figure with two decimal places that is not money, which today is "hoursPerDay" alone
export type Hundredths = number;

export const ACCOUNT_TYPES = [
	'current-account',
	'cash',
	'brokerage-cash',
	'deposit-account',
	'term-deposit',
	'pension-fund',
	'voucher',
	'brokerage'
] as const;

export type AccountType = typeof ACCOUNT_TYPES[number];

// The seven types that hold transactions. "brokerage" is the eighth and holds securities instead.
export const CASH_ACCOUNT_TYPES: readonly AccountType[] = ACCOUNT_TYPES.filter((accountType) => {
	return accountType !== 'brokerage';
});

// Eurozone only, and deliberately so: every amount in the file is EUR, so a listing quoted in anything else is one this
// application has nowhere to record
export const EXCHANGES = [
	'milan',
	'xetra',
	'frankfurt',
	'amsterdam',
	'paris',
	'brussels',
	'lisbon',
	'madrid',
	'vienna',
	'helsinki',
	'dublin',
	'athens',
	'stuttgart',
	'dusseldorf',
	'munich',
	'hamburg',
	'tallinn',
	'vilnius'
] as const;

export type Exchange = typeof EXCHANGES[number];

export const SECURITY_TYPES = [ 'stock', 'stock-etf', 'bond-etf', 'etc' ] as const;

export type SecurityType = typeof SECURITY_TYPES[number];

export const PRICE_SOURCES = [ 'manual', 'fetched' ] as const;

export type PriceSource = typeof PRICE_SOURCES[number];

export const CATEGORY_SOURCES = [ 'automatic', 'manual' ] as const;

export type CategorySource = typeof CATEGORY_SOURCES[number];

export const RECEIPT_STATES = [ 'pending', 'checked', 'na' ] as const;

export type ReceiptState = typeof RECEIPT_STATES[number];

export const TRADE_KINDS = [ 'purchase', 'sale' ] as const;

export type TradeKind = typeof TRADE_KINDS[number];

export const CATEGORY_TYPES = [ 'income', 'expense', 'investment', 'divestment', 'internal', 'revaluation' ] as const;

export type CategoryType = typeof CATEGORY_TYPES[number];

// What the checks and the Portfolio cards key off. Most categories have none, and an empty role means nothing cares about that category.
export const CATEGORY_ROLES = [
	'salary',
	'pension-contribution',
	'securities-purchase',
	'securities-sale',
	'internal-transfer',
	'value-adjustment',
	'bank-fees',
	'wealth-tax',
	'interest-and-dividends'
] as const;

export type CategoryRole = typeof CATEGORY_ROLES[number];

export interface Institution {
	id: LedgerId;
	name: string;
	defaultSellFee: Cents;
	notes: string;
}

export interface Account {
	id: LedgerId;
	name: string;

	// Required on every type but "cash", which is the money that is held by nobody
	institutionId: LedgerId | null;
	type: AccountType;
	openingBalance: Cents;

	// Only on a "pension-fund" account, and null on every other type
	exitTaxRate: TenThousandths | null;
	openingDate: IsoDate;

	// Null means open. Closing an account marks it and sorts it last; it never takes it out of the arithmetic.
	closingDate: IsoDate | null;
	notes: string;
}

export interface Security {
	id: LedgerId;
	isin: string;

	// The code the security's exchange lists it under, which with the exchange is what the price provider is asked for
	ticker: string;
	exchange: Exchange;
	name: string;
	type: SecurityType;
	taxRate: TenThousandths;
	notes: string;
}

// Keyed by security and day: one price per security per day, and recording a second one for a day replaces it
export interface Price {
	securityId: LedgerId;
	date: IsoDate;
	value: TenThousandths;
	source: PriceSource;
}

export interface Transaction {
	id: LedgerId;

	// Never a "brokerage" account
	accountId: LedgerId;
	date: IsoDate;
	description: string;

	// Signed. Negative is money out.
	amount: Cents;

	// Null is legal: a transaction no rule matched is automatic with no category
	categoryId: LedgerId | null;
	categorySource: CategorySource;
	receiptState: ReceiptState;
	notes: string;

	// Monotonic per entity, and never reused
	insertionSeq: number;
}

export interface Trade {
	id: LedgerId;
	kind: TradeKind;
	securityId: LedgerId;

	// Always a "brokerage" account
	accountId: LedgerId;
	date: IsoDate;

	// Always positive: "kind" carries the direction
	quantity: TenThousandths;
	unitPrice: TenThousandths;
	fees: Cents;

	// Withheld by the broker on a sale, and always 0 on a purchase
	taxes: Cents;
	notes: string;
	insertionSeq: number;
}

export interface Contract {
	id: LedgerId;
	name: string;
	monthsPerYear: number;
	hoursPerDay: Hundredths;
	startDate: IsoDate;
	endDate: IsoDate | null;
	notes: string;
}

// Keyed by contract and year. The record exists only where a figure was entered.
export interface ContractYear {
	contractId: LedgerId;
	year: number;
	workingDays: number;
}

export interface Payslip {
	id: LedgerId;
	contractId: LedgerId;

	// The month the pay is for, as printed. Not unique: a month may hold more than one payslip.
	year: number;
	month: number;
	label: string | null;
	contractGross: Cents;
	gross: Cents;

	// Either sign: a month whose deductions exceed its earnings is a real payslip
	netPayment: Cents;

	// Magnitudes, all four of them: the formulas apply the signs
	refunds: Cents;
	carPayment: Cents;
	employeeContribution: Cents;
	employerContribution: Cents;
	severanceContribution: Cents;
	notes: string;
}

// Seeded into every new file and not editable at runtime: adding, renaming or removing one is a change to the application
export interface Category {
	id: LedgerId;
	name: string;
	type: CategoryType;
	role: CategoryRole | null;
	receiptTracked: boolean;

	// The report's row order, and read by nothing else
	order: number;
}

export interface Rule {
	id: LedgerId;

	// First match wins, so the order is the logic
	order: number;
	substring: string;
	categoryId: LedgerId;
}

/**
 * The whole file: the eleven stored entities and the schema version that says which shape they are in.
 * "schemaVersion" is written first so that a person opening the file in an editor reads it before anything else.
 */
export interface LedgerDocument {
	schemaVersion: number;
	institutions: Institution[];
	accounts: Account[];
	securities: Security[];
	prices: Price[];
	transactions: Transaction[];
	trades: Trade[];
	contracts: Contract[];
	contractYears: ContractYear[];
	payslips: Payslip[];
	categories: Category[];
	rules: Rule[];
}

// The keys of the document that hold records, in the order the file writes them
export const LEDGER_ENTITY_KEYS = [
	'institutions',
	'accounts',
	'securities',
	'prices',
	'transactions',
	'trades',
	'contracts',
	'contractYears',
	'payslips',
	'categories',
	'rules'
] as const;

export type LedgerEntityKey = typeof LEDGER_ENTITY_KEYS[number];
