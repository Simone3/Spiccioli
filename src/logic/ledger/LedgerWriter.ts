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
 * Model in, bytes out. The writer is pure and is the reader's counterpart: everything it writes, the reader reads back
 * unchanged, and every figure it writes is the integer it was handed.
 *
 * **Every key is written, and written in one order.** A value that is not there goes out as null rather than being left out,
 * and each record's keys come out in the order the file format documents them. Neither is cosmetic: the reader refuses a
 * missing key exactly as it refuses an unknown one, and a stable key order is what makes a ledger in a synchronised folder
 * produce a diff a person can read.
 *
 * The document is written indented for the same reason. It is read whole and written whole either way, and a file somebody can
 * open in an editor is what "documented well enough for an external script to write it" is worth in practice.
 */

const writeInstitution = (institution: Institution): unknown => {
	return {
		id: institution.id,
		name: institution.name,
		defaultSellFee: institution.defaultSellFee,
		notes: institution.notes
	};
};

const writeAccount = (account: Account): unknown => {
	return {
		id: account.id,
		name: account.name,
		institutionId: account.institutionId,
		type: account.type,
		openingBalance: account.openingBalance,
		exitTaxRate: account.exitTaxRate,
		openingDate: account.openingDate,
		closingDate: account.closingDate,
		notes: account.notes
	};
};

const writeSecurity = (security: Security): unknown => {
	return {
		id: security.id,
		isin: security.isin,
		ticker: security.ticker,
		exchange: security.exchange,
		name: security.name,
		type: security.type,
		taxRate: security.taxRate,
		notes: security.notes
	};
};

const writePrice = (price: Price): unknown => {
	return {
		securityId: price.securityId,
		date: price.date,
		value: price.value,
		source: price.source
	};
};

const writeTransaction = (transaction: Transaction): unknown => {
	return {
		id: transaction.id,
		accountId: transaction.accountId,
		date: transaction.date,
		description: transaction.description,
		amount: transaction.amount,
		categoryId: transaction.categoryId,
		categorySource: transaction.categorySource,
		receiptState: transaction.receiptState,
		notes: transaction.notes,
		insertionSeq: transaction.insertionSeq
	};
};

const writeTrade = (trade: Trade): unknown => {
	return {
		id: trade.id,
		kind: trade.kind,
		securityId: trade.securityId,
		accountId: trade.accountId,
		date: trade.date,
		quantity: trade.quantity,
		unitPrice: trade.unitPrice,
		fees: trade.fees,
		taxes: trade.taxes,
		notes: trade.notes,
		insertionSeq: trade.insertionSeq
	};
};

const writeContract = (contract: Contract): unknown => {
	return {
		id: contract.id,
		name: contract.name,
		monthsPerYear: contract.monthsPerYear,
		hoursPerDay: contract.hoursPerDay,
		startDate: contract.startDate,
		endDate: contract.endDate,
		notes: contract.notes
	};
};

const writeContractYear = (contractYear: ContractYear): unknown => {
	return {
		contractId: contractYear.contractId,
		year: contractYear.year,
		workingDays: contractYear.workingDays
	};
};

const writePayslip = (payslip: Payslip): unknown => {
	return {
		id: payslip.id,
		contractId: payslip.contractId,
		year: payslip.year,
		month: payslip.month,
		label: payslip.label,
		contractGross: payslip.contractGross,
		gross: payslip.gross,
		netPayment: payslip.netPayment,
		refunds: payslip.refunds,
		carPayment: payslip.carPayment,
		employeeContribution: payslip.employeeContribution,
		employerContribution: payslip.employerContribution,
		severanceContribution: payslip.severanceContribution,
		notes: payslip.notes
	};
};

const writeCategory = (category: Category): unknown => {
	return {
		id: category.id,
		name: category.name,
		type: category.type,
		role: category.role,
		receiptTracked: category.receiptTracked,
		order: category.order
	};
};

const writeRule = (rule: Rule): unknown => {
	return {
		id: rule.id,
		order: rule.order,
		substring: rule.substring,
		categoryId: rule.categoryId
	};
};

/**
 * Writes the whole document out as the text of a ledger file.
 * @param document The model.
 * @returns The file, ending in a newline.
 */
export const writeLedgerDocument = (document: LedgerDocument): string => {
	const serializable = {
		schemaVersion: document.schemaVersion,
		institutions: document.institutions.map(writeInstitution),
		accounts: document.accounts.map(writeAccount),
		securities: document.securities.map(writeSecurity),
		prices: document.prices.map(writePrice),
		transactions: document.transactions.map(writeTransaction),
		trades: document.trades.map(writeTrade),
		contracts: document.contracts.map(writeContract),
		contractYears: document.contractYears.map(writeContractYear),
		payslips: document.payslips.map(writePayslip),
		categories: document.categories.map(writeCategory),
		rules: document.rules.map(writeRule)
	};

	return `${JSON.stringify(serializable, undefined, '\t')}\n`;
};
