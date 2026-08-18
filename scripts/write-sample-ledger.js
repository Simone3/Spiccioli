const fs = require('node:fs');
const path = require('node:path');
const { projectRoot } = require('./electron-bundle');

// Writes a ".spiccioli" file the application opens, built from nothing but what "docs/technical/09-file-format.md" documents.
//
// That is the whole point of it. Ten years of history are meant to be loaded into Spiccioli by a one-off migration script rather than by
// the application, so §9 has to be complete enough for somebody to write that script from it alone. This file is the proof: it imports
// nothing from "src", it was written by reading §9's tables, and "tests/logic/FileFormat.test.ts" runs it and hands the bytes to the
// application's own reader. A field §9 forgot to mention, or a scale it states wrongly, is a refusal here.
//
// It is also the worked example a migration script starts from: every entity is populated, including the ones a small file leaves empty.

const DEFAULT_OUTPUT_PATH = path.join(projectRoot, 'dist', 'sample-ledger.spiccioli');

// §9.4. This build writes and reads version 1.
const SCHEMA_VERSION = 1;

// §9.3. The twenty-seven seeded categories, with the type, role, receiptTracked and order of the functional analysis' §6.3. A file
// written from scratch carries all of them, and an id that is not on this list is refused.
const CATEGORIES = [
	{ id: 'salary', name: 'Salary', type: 'income', role: 'salary', receiptTracked: true, order: 1 },
	{ id: 'pension-fund-contribution', name: 'Pension fund contribution', type: 'income', role: 'pension-contribution', receiptTracked: false, order: 2 },
	{ id: 'reimbursement', name: 'Reimbursement', type: 'income', role: null, receiptTracked: false, order: 3 },
	{ id: 'gift-received', name: 'Gift received', type: 'income', role: null, receiptTracked: false, order: 4 },
	{ id: 'other-income', name: 'Other income', type: 'income', role: null, receiptTracked: false, order: 5 },
	{ id: 'interest-dividends-and-bonuses', name: 'Interest, dividends & bonuses', type: 'income', role: 'interest-and-dividends', receiptTracked: false, order: 6 },
	{ id: 'voucher-top-up', name: 'Voucher top-up', type: 'income', role: null, receiptTracked: false, order: 7 },
	{ id: 'restaurants-and-bars', name: 'Restaurants & bars', type: 'expense', role: null, receiptTracked: false, order: 8 },
	{ id: 'groceries', name: 'Groceries', type: 'expense', role: null, receiptTracked: false, order: 9 },
	{ id: 'travel', name: 'Travel', type: 'expense', role: null, receiptTracked: false, order: 10 },
	{ id: 'home-and-household', name: 'Home & household', type: 'expense', role: null, receiptTracked: false, order: 11 },
	{ id: 'rent-and-condominium-fees', name: 'Rent & condominium fees', type: 'expense', role: null, receiptTracked: true, order: 12 },
	{ id: 'electricity', name: 'Electricity', type: 'expense', role: null, receiptTracked: true, order: 13 },
	{ id: 'home-internet', name: 'Home internet', type: 'expense', role: null, receiptTracked: true, order: 14 },
	{ id: 'mobile-and-phone', name: 'Mobile & phone', type: 'expense', role: null, receiptTracked: true, order: 15 },
	{ id: 'entertainment', name: 'Entertainment', type: 'expense', role: null, receiptTracked: false, order: 16 },
	{ id: 'other-expense', name: 'Other expense', type: 'expense', role: null, receiptTracked: false, order: 17 },
	{ id: 'bank-fees', name: 'Bank fees', type: 'expense', role: 'bank-fees', receiptTracked: false, order: 18 },
	{ id: 'income-and-other-taxes', name: 'Income & other taxes', type: 'expense', role: null, receiptTracked: true, order: 19 },
	{ id: 'wealth-tax', name: 'Wealth tax', type: 'expense', role: 'wealth-tax', receiptTracked: false, order: 20 },
	{ id: 'culture-and-education', name: 'Culture & education', type: 'expense', role: null, receiptTracked: false, order: 21 },
	{ id: 'health-and-personal-care', name: 'Health & personal care', type: 'expense', role: null, receiptTracked: false, order: 22 },
	{ id: 'technology-and-devices', name: 'Technology & devices', type: 'expense', role: null, receiptTracked: false, order: 23 },
	{ id: 'internal-transfer', name: 'Internal transfer', type: 'internal', role: 'internal-transfer', receiptTracked: false, order: 24 },
	{ id: 'securities-purchase', name: 'Securities purchase', type: 'investment', role: 'securities-purchase', receiptTracked: false, order: 25 },
	{ id: 'securities-sale', name: 'Securities sale', type: 'divestment', role: 'securities-sale', receiptTracked: false, order: 26 },
	{ id: 'value-adjustment', name: 'Value adjustment', type: 'revaluation', role: 'value-adjustment', receiptTracked: false, order: 27 }
];

// §9.2. An id is any non-empty string that is unique within its entity, and it is never shown to the user, so a migration script is free
// to build one out of whatever it is migrating from. These read as what they are on purpose: an unreadable file is no use to debug with.
const FINECO = 'institution-fineco';
const INTESA = 'institution-intesa';
const CURRENT_ACCOUNT = 'account-current';
const CASH = 'account-cash';
const BROKERAGE_CASH = 'account-brokerage-cash';
const BROKERAGE = 'account-brokerage';
const PENSION_FUND = 'account-pension-fund';
const WORLD_ETF = 'security-world-etf';
const BOND_ETF = 'security-bond-etf';
const CONTRACT = 'contract-acme';

/**
 * Builds the sample document.
 *
 * Every figure is an integer at the scale §9.2 fixes: amounts in cents, quantities in millionths, unit prices and rates in
 * ten-thousandths, and "hoursPerDay" in hundredths. Every key of every record is present, and a value that is not there is null.
 * @returns The document, ready to be serialized.
 */
const buildSampleLedger = () => {
	return {
		schemaVersion: SCHEMA_VERSION,

		institutions: [
			{ id: FINECO, name: 'Fineco', defaultSellFee: 295, notes: '' },
			{ id: INTESA, name: 'Intesa Sanpaolo', defaultSellFee: 900, notes: 'Pension fund only' }
		],

		// "institutionId" is null only on a cash account, "exitTaxRate" is set only on a pension fund, and "openingBalance" is always 0
		// on a brokerage account, whose worth is the securities held in it
		accounts: [
			{
				id: CURRENT_ACCOUNT,
				name: 'Conto Corrente',
				institutionId: FINECO,
				type: 'current-account',
				openingBalance: 250000,
				exitTaxRate: null,
				openingDate: '2016-03-01',
				closingDate: null,
				notes: ''
			},
			{
				id: CASH,
				name: 'Contanti',
				institutionId: null,
				type: 'cash',
				openingBalance: 12000,
				exitTaxRate: null,
				openingDate: '2016-03-01',
				closingDate: null,
				notes: ''
			},
			{
				id: BROKERAGE_CASH,
				name: 'Liquidità Titoli',
				institutionId: FINECO,
				type: 'brokerage-cash',
				openingBalance: 0,
				exitTaxRate: null,
				openingDate: '2019-06-14',
				closingDate: null,
				notes: ''
			},
			{
				id: BROKERAGE,
				name: 'Deposito Titoli',
				institutionId: FINECO,
				type: 'brokerage',
				openingBalance: 0,
				exitTaxRate: null,
				openingDate: '2019-06-14',
				closingDate: null,
				notes: ''
			},
			{
				id: PENSION_FUND,
				name: 'Fondo Pensione',
				institutionId: INTESA,
				type: 'pension-fund',
				openingBalance: 1500000,
				exitTaxRate: 1500,
				openingDate: '2018-01-15',
				closingDate: null,
				notes: '15% exit tax after 35 years of contributions'
			}
		],

		securities: [
			{
				id: WORLD_ETF,
				isin: 'IE00B4L5Y983',
				ticker: 'SWDA',
				exchange: 'milan',
				name: 'iShares Core MSCI World',
				type: 'stock-etf',
				taxRate: 2600,
				notes: ''
			},
			{
				id: BOND_ETF,
				isin: 'IE00B4WXJJ64',
				ticker: 'IBGL',
				exchange: 'milan',
				name: 'iShares Core Euro Government Bond',
				type: 'bond-etf',
				taxRate: 1250,
				notes: 'White list, taxed at 12,5%'
			}
		],

		// One price per security per day. Two records for one pair are refused, whichever way round they are written.
		prices: [
			{ securityId: WORLD_ETF, date: '2026-07-31', value: 1041500, source: 'manual' },
			{ securityId: WORLD_ETF, date: '2026-08-07', value: 1054300, source: 'fetched' },
			{ securityId: BOND_ETF, date: '2026-08-07', value: 1187200, source: 'fetched' }
		],

		// Never on a brokerage account, and "insertionSeq" is monotonic among transactions alone.
		//
		// An "automatic" row takes on the invariant of §9.3: its category has to be what this file's own rule list would produce, first
		// match wins. The last row here is the case that has no category at all, which is what a row no rule matched looks like; the two
		// rows the rules would not have found are written "manual", which is the way out of the invariant.
		transactions: [
			{
				id: 'transaction-1',
				accountId: CURRENT_ACCOUNT,
				date: '2026-07-27',
				description: 'STIPENDIO LUGLIO ACME SPA',
				amount: 235000,
				categoryId: 'salary',
				categorySource: 'automatic',
				receiptState: 'checked',
				notes: '',
				insertionSeq: 1
			},
			{
				id: 'transaction-2',
				accountId: CURRENT_ACCOUNT,
				date: '2026-08-01',
				description: 'BONIFICO INTERNO VERSO DEPOSITO TITOLI',
				amount: -500000,
				categoryId: 'internal-transfer',
				categorySource: 'automatic',
				receiptState: 'na',
				notes: '',
				insertionSeq: 2
			},
			{
				id: 'transaction-3',
				accountId: BROKERAGE_CASH,
				date: '2026-08-01',
				description: 'BONIFICO INTERNO DA CONTO CORRENTE',
				amount: 500000,
				categoryId: 'internal-transfer',
				categorySource: 'automatic',
				receiptState: 'na',
				notes: '',
				insertionSeq: 3
			},
			{
				id: 'transaction-4',
				accountId: BROKERAGE_CASH,
				date: '2026-08-05',
				description: 'ACQUISTO QUOTE SWDA',
				amount: -130683,
				categoryId: 'securities-purchase',
				categorySource: 'manual',
				receiptState: 'na',
				notes: '',
				insertionSeq: 4
			},
			{
				id: 'transaction-5',
				accountId: CURRENT_ACCOUNT,
				date: '2026-08-06',
				description: 'ESSELUNGA MILANO VIA RIPAMONTI',
				amount: -4250,
				categoryId: 'groceries',
				categorySource: 'automatic',
				receiptState: 'na',
				notes: '',
				insertionSeq: 5
			},
			{
				id: 'transaction-6',
				accountId: CURRENT_ACCOUNT,
				date: '2026-08-07',
				description: 'COMPETENZE E SPESE TRIMESTRALI',
				amount: -1050,
				categoryId: 'bank-fees',
				categorySource: 'manual',
				receiptState: 'na',
				notes: '',
				insertionSeq: 6
			},
			{
				id: 'transaction-7',
				accountId: CASH,
				date: '2026-08-08',
				description: 'PAGAMENTO POS RISTORANTE',
				amount: -3200,
				categoryId: null,
				categorySource: 'automatic',
				receiptState: 'pending',
				notes: 'No rule claims this one',
				insertionSeq: 7
			}
		],

		// Always on a brokerage account. The quantity is positive on both kinds — "kind" is what carries the direction — and "taxes" is 0
		// on every purchase, a broker withholding nothing on the way in.
		trades: [
			{
				id: 'trade-1',
				kind: 'purchase',
				securityId: WORLD_ETF,
				accountId: BROKERAGE,
				date: '2026-08-05',
				quantity: 12500000,
				unitPrice: 1043100,
				fees: 295,
				taxes: 0,
				notes: '',
				insertionSeq: 1
			},
			{
				id: 'trade-2',
				kind: 'purchase',
				securityId: BOND_ETF,
				accountId: BROKERAGE,
				date: '2026-08-05',
				quantity: 3000000,
				unitPrice: 1180000,
				fees: 295,
				taxes: 0,
				notes: '',
				insertionSeq: 2
			},
			{
				id: 'trade-3',
				kind: 'sale',
				securityId: WORLD_ETF,
				accountId: BROKERAGE,
				date: '2026-08-07',
				quantity: 2500000,
				unitPrice: 1054300,
				fees: 295,
				taxes: 728,
				notes: '',
				insertionSeq: 3
			}
		],

		contracts: [
			{
				id: CONTRACT,
				name: 'Acme S.p.A.',
				monthsPerYear: 13,
				hoursPerDay: 800,
				startDate: '2019-01-07',
				endDate: null,
				notes: ''
			}
		],

		// One record per contract and year, and only for a year whose working days were entered
		contractYears: [
			{ contractId: CONTRACT, year: 2025, workingDays: 252 },
			{ contractId: CONTRACT, year: 2026, workingDays: 253 }
		],

		// "label" names the payslip a month may hold more than one of; it is null on an ordinary monthly one. Every magnitude field is
		// written unsigned, the formulas of the functional analysis' §11.7 being what applies the signs.
		payslips: [
			{
				id: 'payslip-2025-13',
				contractId: CONTRACT,
				year: 2025,
				month: 12,
				label: '13th',
				contractGross: 250000,
				gross: 250000,
				netPayment: 187500,
				refunds: 0,
				carPayment: 0,
				employeeContribution: 22500,
				employerContribution: 72500,
				severanceContribution: 17361,
				notes: ''
			},
			{
				id: 'payslip-2026-07',
				contractId: CONTRACT,
				year: 2026,
				month: 7,
				label: null,
				contractGross: 320000,
				gross: 336000,
				netPayment: 235000,
				refunds: 16000,
				carPayment: 8500,
				employeeContribution: 28800,
				employerContribution: 92800,
				severanceContribution: 22222,
				notes: ''
			}
		],

		categories: CATEGORIES,

		// First match wins, and a rule always points at a category. The substrings are matched case- and accent-insensitively against a
		// transaction's description alone.
		rules: [
			{ id: 'rule-1', order: 1, substring: 'STIPENDIO', categoryId: 'salary' },
			{ id: 'rule-2', order: 2, substring: 'BONIFICO INTERNO', categoryId: 'internal-transfer' },
			{ id: 'rule-3', order: 3, substring: 'ESSELUNGA', categoryId: 'groceries' }
		]
	};
};

/**
 * Serializes the document the way the application would write it.
 *
 * Nothing requires this layout — §9.1 accepts any JSON the reader accepts, and the next save rewrites the file in the application's own
 * shape — but a file that already looks like one the application wrote is easier to compare against one it did.
 * @param document The document to serialize.
 * @returns The bytes of the file, newline-terminated.
 */
const serializeSampleLedger = (document) => {
	return `${JSON.stringify(document, null, '\t')}\n`;
};

/**
 * Writes the sample file.
 * @param outputPath Where to write it. The directory is created if it is not there.
 * @returns The path that was written.
 */
const writeSampleLedger = (outputPath) => {
	fs.mkdirSync(path.dirname(outputPath), { recursive: true });
	fs.writeFileSync(outputPath, serializeSampleLedger(buildSampleLedger()), 'utf8');

	return outputPath;
};

module.exports = {
	DEFAULT_OUTPUT_PATH,
	buildSampleLedger,
	serializeSampleLedger,
	writeSampleLedger
};

// Run directly, it writes the file and says where. Required by a test, it exports the three functions above and writes nothing.
if(require.main === module) {
	const outputPath = process.argv[2] === undefined ? DEFAULT_OUTPUT_PATH : path.resolve(process.argv[2]);

	writeSampleLedger(outputPath);
	console.log(`Wrote a sample ledger to ${outputPath}`);
}
