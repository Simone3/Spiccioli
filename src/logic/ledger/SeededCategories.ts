import type { SpiccioliTranslationKey, SpiccioliTranslator } from 'src/i18n/Translations';
import type { Category, CategoryRole, CategoryType, LedgerId } from 'src/types/LedgerTypes';

/**
 * The twenty-seven categories seeded into every new file.
 *
 * Categories are stored but not editable at runtime: adding, renaming or removing one is a change to the application. That is
 * what lets their ids be written down here rather than generated — a category id is referenced by every transaction and every
 * rule that points at it, in this file and in the ones a migration script writes, so it has to read the same in both.
 *
 * The **names are not** written down here. They are wording, so they live in the translation bundle like every other string the
 * user can read, and the seed copies them into the file as it writes it. Nothing reads them back: the report groups by "type",
 * the checks key off "role", and the report's row order is "order".
 */

interface SeededCategory {
	id: LedgerId;
	nameKey: SpiccioliTranslationKey;
	type: CategoryType;
	role: CategoryRole | null;
	receiptTracked: boolean;

	// The report's reading order: 1 – 7 is the Income group, 8 – 23 Expense, 24 Internal, and 25 – 27 the Investments group below Net
	order: number;
}

export const SEEDED_CATEGORIES: readonly SeededCategory[] = [
	{ id: 'salary', nameKey: 'categories.salary', type: 'income', role: 'salary', receiptTracked: true, order: 1 },
	{ id: 'pension-fund-contribution', nameKey: 'categories.pensionFundContribution', type: 'income', role: 'pension-contribution', receiptTracked: false, order: 2 },
	{ id: 'reimbursement', nameKey: 'categories.reimbursement', type: 'income', role: null, receiptTracked: false, order: 3 },
	{ id: 'gift-received', nameKey: 'categories.giftReceived', type: 'income', role: null, receiptTracked: false, order: 4 },
	{ id: 'other-income', nameKey: 'categories.otherIncome', type: 'income', role: null, receiptTracked: false, order: 5 },
	{ id: 'interest-dividends-and-bonuses', nameKey: 'categories.interestDividendsAndBonuses', type: 'income', role: 'interest-and-dividends', receiptTracked: false, order: 6 },
	{ id: 'voucher-top-up', nameKey: 'categories.voucherTopUp', type: 'income', role: null, receiptTracked: false, order: 7 },
	{ id: 'restaurants-and-bars', nameKey: 'categories.restaurantsAndBars', type: 'expense', role: null, receiptTracked: false, order: 8 },
	{ id: 'groceries', nameKey: 'categories.groceries', type: 'expense', role: null, receiptTracked: false, order: 9 },
	{ id: 'travel', nameKey: 'categories.travel', type: 'expense', role: null, receiptTracked: false, order: 10 },
	{ id: 'home-and-household', nameKey: 'categories.homeAndHousehold', type: 'expense', role: null, receiptTracked: false, order: 11 },
	{ id: 'rent-and-condominium-fees', nameKey: 'categories.rentAndCondominiumFees', type: 'expense', role: null, receiptTracked: true, order: 12 },
	{ id: 'electricity', nameKey: 'categories.electricity', type: 'expense', role: null, receiptTracked: true, order: 13 },
	{ id: 'home-internet', nameKey: 'categories.homeInternet', type: 'expense', role: null, receiptTracked: true, order: 14 },
	{ id: 'mobile-and-phone', nameKey: 'categories.mobileAndPhone', type: 'expense', role: null, receiptTracked: true, order: 15 },
	{ id: 'entertainment', nameKey: 'categories.entertainment', type: 'expense', role: null, receiptTracked: false, order: 16 },
	{ id: 'other-expense', nameKey: 'categories.otherExpense', type: 'expense', role: null, receiptTracked: false, order: 17 },
	{ id: 'bank-fees', nameKey: 'categories.bankFees', type: 'expense', role: 'bank-fees', receiptTracked: false, order: 18 },
	{ id: 'income-and-other-taxes', nameKey: 'categories.incomeAndOtherTaxes', type: 'expense', role: null, receiptTracked: true, order: 19 },
	{ id: 'wealth-tax', nameKey: 'categories.wealthTax', type: 'expense', role: 'wealth-tax', receiptTracked: false, order: 20 },
	{ id: 'culture-and-education', nameKey: 'categories.cultureAndEducation', type: 'expense', role: null, receiptTracked: false, order: 21 },
	{ id: 'health-and-personal-care', nameKey: 'categories.healthAndPersonalCare', type: 'expense', role: null, receiptTracked: false, order: 22 },
	{ id: 'technology-and-devices', nameKey: 'categories.technologyAndDevices', type: 'expense', role: null, receiptTracked: false, order: 23 },
	{ id: 'internal-transfer', nameKey: 'categories.internalTransfer', type: 'internal', role: 'internal-transfer', receiptTracked: false, order: 24 },
	{ id: 'securities-purchase', nameKey: 'categories.securitiesPurchase', type: 'investment', role: 'securities-purchase', receiptTracked: false, order: 25 },
	{ id: 'securities-sale', nameKey: 'categories.securitiesSale', type: 'divestment', role: 'securities-sale', receiptTracked: false, order: 26 },
	{ id: 'value-adjustment', nameKey: 'categories.valueAdjustment', type: 'revaluation', role: 'value-adjustment', receiptTracked: false, order: 27 }
];

// Which category ids this version of the application knows about. A file holding any other one is a file it does not understand.
export const SEEDED_CATEGORY_IDS: ReadonlySet<LedgerId> = new Set(SEEDED_CATEGORIES.map((category) => {
	return category.id;
}));

/**
 * Builds the category records a new file is seeded with, in the report's own order.
 * @param translator The wording the names are copied from, which is the one place they are written.
 * @returns The twenty-seven categories, ready to be written.
 */
export const createSeededCategories = (translator: SpiccioliTranslator): Category[] => {
	return SEEDED_CATEGORIES.map((category) => {
		return {
			id: category.id,
			name: translator.t(category.nameKey),
			type: category.type,
			role: category.role,
			receiptTracked: category.receiptTracked,
			order: category.order
		};
	});
};
