import { CHECKS_CONFIG } from 'src/config/AppConfig';
import { formatAccountName, indexInstitutions, isAccountClosed, sortAccounts } from 'src/logic/accounts/Accounts';
import { categoryIdsWithRole, indexCategories } from 'src/logic/categories/Categories';
import { addMonthsToIsoDate, daysBetweenIsoDates } from 'src/logic/checks/CheckDates';
import { pensionFigureAmount, PENSION_FIGURES, type DerivedMatching, type PensionClaim } from 'src/logic/checks/Matching';
import { compareTradesInWalkOrder, walkPositions, type PositionWalk } from 'src/logic/investments/Holdings';
import { indexLatestPrices, indexSecurities, sortSecurities } from 'src/logic/investments/Securities';
import { sortTrades, tradeSettlement, tradesOfKind, tradeTotal } from 'src/logic/investments/Trades';
import { formatPayslipPeriod } from 'src/logic/salaries/Payslips';
import { sortTransactions } from 'src/logic/transactions/Transactions';
import type { Formatter } from 'src/logic/format/Formatter';
import type { SpiccioliTranslator } from 'src/i18n/Translations';
import type {
	Account,
	Cents,
	IsoDate,
	LedgerDocument,
	LedgerId,
	Payslip,
	Trade,
	TradeKind,
	Transaction
} from 'src/types/LedgerTypes';
import type { Preferences } from 'src/types/PreferencesTypes';

/**
 * The fourteen checks of [§9], in the order that document puts them in.
 *
 * **Two states only, pass or fail.** There is no warning tier, nothing sorts a failure to the top, and **a check never prevents
 * anything**: it reports what the file holds and the record is written either way.
 *
 * **A passing check states its reach** — “117 payslips”, “41 purchases” — so a check that passed because it examined nothing is
 * distinguishable from one that passed properly. **A failing one names at most five records and states the whole count**, the
 * five being the first five in the ascending ordering of the records themselves, oldest first. There is no “show all”: the fix for a check naming
 * two hundred records is the screen the records live on, which is one click away through any of the five links.
 *
 * **Every check reads the whole file, closed accounts included**, and **every one of them keys off category roles rather than
 * category names**. Check 10 is the one exception to the first: it reads open pension fund accounts only, what a closed one
 * still owes being check 11's question.
 *
 * The wording lives here rather than on the screen because each failure line is bespoke, and a check that names a record has to
 * write that record the way the rest of the application writes it — *Institution · Account*, the amount with its sign, the day
 * in the preferred format.
 */

// The fourteen, in the order of the specification's table. The screen draws them in this order, failing and passing alike.
export const CHECK_IDS = [
	'transfersBalance',
	'transactionsCategorised',
	'pricesRecent',
	'payslipsMatchSalaries',
	'pensionContributionsMatch',
	'purchasesMatch',
	'salesMatch',
	'noNegativeHolding',
	'noSaleBeforePurchase',
	'pensionFundRevalued',
	'closedAccountsEmpty',
	'recordsWithinAccountLife',
	'receiptTrackedHaveState',
	'noOverduePendingReceipt'
] as const;

export type CheckId = typeof CHECK_IDS[number];

/**
 * Where an entry's link goes: the screen the record lives on, with enough to find it there.
 * **Every entry links to the record it names**, and the screen it lands on is the ordinary one, reached with its filters set.
 */
export type CheckLink = {
	screen: 'transactions';
	accountId: LedgerId;
	date: IsoDate;
} | {
	screen: 'trades';
	kind: TradeKind;
	securityId: LedgerId;
	accountId: LedgerId;
	date: IsoDate;
} | {
	screen: 'payslips';
	contractId: LedgerId;
	year: number;
} | {
	screen: 'securities';
	securityId: LedgerId;
} | {
	screen: 'accounts';
	accountId: LedgerId;
};

/** One record a failing check names, written the way the application writes it, and the way back to it. */
export interface CheckEntry {
	key: string;
	text: string;
	link: CheckLink;
}

/**
 * One list a failing check reports. Checks 4, 5, 6 and 7 have two — the records left over on each side — and every other
 * failing check has one.
 */
export interface CheckSide {
	key: string;

	// What this list is called, on the checks that report two. Undefined on the checks that report one.
	label: string | undefined;

	// How many records this side names in all, of which at most five are carried
	total: number;

	entries: readonly CheckEntry[];
}

export interface CheckResult {
	id: CheckId;
	passed: boolean;

	// What the check examined, stated whether it passed or failed: "117 payslips"
	reach: string;

	// Empty on a passing check
	sides: readonly CheckSide[];
}

export interface ChecksOptions {
	document: LedgerDocument;
	preferences: Preferences;

	// The five pairings, which checks 1, 4, 5, 6 and 7 report the leftovers of
	matching: DerivedMatching;

	translator: SpiccioliTranslator;

	// The reading of the preferences that writes an amount and a day the way [§10] says they look
	formatter: Formatter;

	// The computer's own clock, read at the moment the run starts. Every age below rests on it.
	today: IsoDate;
}

/**
 * How a check writes the records it names: the same way the rest of the application writes them — *Institution · Account*, the
 * amount with its sign, the day in the preferred format. Built once per run, because every one of the fourteen reads it.
 */
interface CheckNaming {
	accountName: (accountId: LedgerId) => string;
	tickerOf: (securityId: LedgerId) => string;
	contractName: (contractId: LedgerId) => string;

	// A payslip's month, with its label where it has one: the way [§5.1] names one in the *Matched* column
	monthOf: (payslip: Payslip) => string;

	// The one line four checks name a transaction with, and the one three name a trade with. The text is overridable, the link is not.
	transactionEntry: (transaction: Transaction, text?: string) => CheckEntry;
	tradeEntry: (trade: Trade, text?: string) => CheckEntry;
	payslipLink: (payslip: Payslip) => CheckLink;
}

interface CheckContext extends ChecksOptions {
	accounts: ReadonlyMap<LedgerId, Account>;
	walk: PositionWalk;
	naming: CheckNaming;
}

/**
 * Builds one side of a failing check: the whole count, and the first five records in the ascending ordering of the records themselves.
 * @param key What tells this side from the other one.
 * @param label What the side is called, on a check that reports two.
 * @param entries Every record the side names, already ordered.
 * @returns The side.
 */
const buildSide = (key: string, label: string | undefined, entries: readonly CheckEntry[]): CheckSide => {
	return { key, label, total: entries.length, entries: entries.slice(0, CHECKS_CONFIG.maximumEntriesPerSide) };
};

// Everything below reads one context and words one check

const buildNaming = (options: ChecksOptions, accounts: ReadonlyMap<LedgerId, Account>): CheckNaming => {
	const { document, translator, formatter } = options;
	const institutions = indexInstitutions(document.institutions);
	const securities = indexSecurities(document.securities);
	const contracts = new Map(document.contracts.map((contract) => {
		return [ contract.id, contract.name ];
	}));

	const accountName = (accountId: LedgerId): string => {
		const account = accounts.get(accountId);

		return account ? formatAccountName(account, institutions, translator) : '';
	};

	const tickerOf = (securityId: LedgerId): string => {
		return securities.get(securityId)?.ticker ?? '';
	};

	return {
		accountName,
		tickerOf,
		contractName: (contractId) => {
			return contracts.get(contractId) ?? '';
		},
		monthOf: (payslip) => {
			return formatPayslipPeriod(payslip, translator);
		},
		transactionEntry: (transaction, text) => {
			return {
				key: transaction.id,
				text: text ?? translator.t('checks.entries.transaction', {
					date: formatter.storedDate(transaction.date),
					account: accountName(transaction.accountId),
					description: transaction.description,
					amount: formatter.amount(transaction.amount, true)
				}),
				link: { screen: 'transactions', accountId: transaction.accountId, date: transaction.date }
			};
		},
		tradeEntry: (trade, text) => {
			return {
				key: trade.id,
				text: text ?? translator.t('checks.entries.trade', {
					date: formatter.storedDate(trade.date),
					ticker: tickerOf(trade.securityId),
					account: accountName(trade.accountId),
					total: formatter.amount(tradeTotal(trade))
				}),
				link: {
					screen: 'trades',
					kind: trade.kind,
					securityId: trade.securityId,
					accountId: trade.accountId,
					date: trade.date
				}
			};
		},
		payslipLink: (payslip) => {
			return { screen: 'payslips', contractId: payslip.contractId, year: payslip.year };
		}
	};
};

const checkTransfersBalance = (context: CheckContext): CheckResult => {
	const { matching, translator } = context;
	const { transactionEntry } = context.naming;
	const reach = translator.t('checks.reach.transferLegs', { count: matching.transfers.legCount });

	if(matching.transfers.unpaired.length === 0) {
		return { id: 'transfersBalance', passed: true, reach, sides: [] };
	}

	return {
		id: 'transfersBalance',
		passed: false,
		reach,
		sides: [ buildSide('legs', undefined, matching.transfers.unpaired.map((leg) => {
			return transactionEntry(leg);
		})) ]
	};
};

const checkTransactionsCategorised = (context: CheckContext): CheckResult => {
	const { document, translator } = context;
	const { transactionEntry } = context.naming;
	const reach = translator.t('checks.reach.transactions', { count: document.transactions.length });

	const uncategorised = sortTransactions(document.transactions.filter((transaction) => {
		return transaction.categoryId === null;
	}));

	if(uncategorised.length === 0) {
		return { id: 'transactionsCategorised', passed: true, reach, sides: [] };
	}

	return {
		id: 'transactionsCategorised',
		passed: false,
		reach,
		sides: [ buildSide('transactions', undefined, uncategorised.map((transaction) => {
			return transactionEntry(transaction);
		})) ]
	};
};

/**
 * Check 3. **No price at all fails too, and is the more serious of the two**: that holding is valued at zero everywhere.
 * @param context What the check reads.
 * @returns The result.
 */
const checkPricesRecent = (context: CheckContext): CheckResult => {
	const { document, preferences, translator, formatter, today, walk } = context;
	const latestPrices = indexLatestPrices(document.prices);

	const held = new Set<LedgerId>();

	for(const position of walk.positions.values()) {
		if(!position.oversold && position.quantity > 0) {
			held.add(position.securityId);
		}
	}

	const securities = sortSecurities(document.securities.filter((security) => {
		return held.has(security.id);
	}));

	const reach = translator.t('checks.reach.securitiesHeld', { count: securities.length });
	const entries: CheckEntry[] = [];

	for(const security of securities) {
		const latest = latestPrices.get(security.id);
		const age = latest ? daysBetweenIsoDates(latest.date, today) : 0;

		if(latest && age <= preferences.priceStalenessDays) {
			continue;
		}

		entries.push({
			key: security.id,
			text: latest ?
				translator.t('checks.entries.stalePrice', {
					ticker: security.ticker,
					name: security.name,
					price: formatter.unitPrice(latest.value),
					date: formatter.storedDate(latest.date),
					count: age
				}) :
				translator.t('checks.entries.noPrice', { ticker: security.ticker, name: security.name }),
			link: { screen: 'securities', securityId: security.id }
		});
	}

	if(entries.length === 0) {
		return { id: 'pricesRecent', passed: true, reach, sides: [] };
	}

	return { id: 'pricesRecent', passed: false, reach, sides: [ buildSide('securities', undefined, entries) ] };
};

const checkPayslipsMatchSalaries = (context: CheckContext): CheckResult => {
	const { document, matching, translator, formatter } = context;
	const { transactionEntry, monthOf, payslipLink, contractName } = context.naming;
	const reach = translator.t('checks.reach.payslips', { count: document.payslips.length });
	const { unmatchedPayslips, unmatchedTransactions } = matching.salaries;

	if(unmatchedPayslips.length === 0 && unmatchedTransactions.length === 0) {
		return { id: 'payslipsMatchSalaries', passed: true, reach, sides: [] };
	}

	return {
		id: 'payslipsMatchSalaries',
		passed: false,
		reach,
		sides: [
			buildSide('payslips', translator.t('checks.sides.payslips'), unmatchedPayslips.map((payslip) => {
				return {
					key: payslip.id,
					text: translator.t('checks.entries.payslip', {
						month: monthOf(payslip),
						contract: contractName(payslip.contractId),
						amount: formatter.amount(payslip.netPayment, true)
					}),
					link: payslipLink(payslip)
				};
			})),
			buildSide('transactions', translator.t('checks.sides.transactions'), unmatchedTransactions.map((transaction) => {
				return transactionEntry(transaction);
			}))
		]
	};
};

/**
 * Check 5. **A figure of 0 is not a claim**: it expects no credit, takes no part in the walk and cannot be reported here.
 * @param context What the check reads.
 * @returns The result.
 */
const checkPensionContributionsMatch = (context: CheckContext): CheckResult => {
	const { document, matching, translator, formatter } = context;
	const { transactionEntry, monthOf, payslipLink, contractName } = context.naming;

	const figureCount = document.payslips.reduce((running, payslip) => {
		return running + PENSION_FIGURES.filter((figure) => {
			return pensionFigureAmount(payslip, figure) !== 0;
		}).length;
	}, 0);

	const reach = translator.t('checks.reach.contributions', { count: figureCount });
	const { unmatchedFigures, unmatchedTransactions } = matching.pension;

	if(unmatchedFigures.length === 0 && unmatchedTransactions.length === 0) {
		return { id: 'pensionContributionsMatch', passed: true, reach, sides: [] };
	}

	const figureEntry = (claim: PensionClaim): CheckEntry => {
		return {
			key: `${claim.payslip.id}|${claim.figure}`,
			text: translator.t('checks.entries.pensionFigure', {
				month: monthOf(claim.payslip),
				contract: contractName(claim.payslip.contractId),
				figure: translator.t(`checks.pensionFigures.${claim.figure}`),
				amount: formatter.amount(claim.amount, true)
			}),
			link: payslipLink(claim.payslip)
		};
	};

	return {
		id: 'pensionContributionsMatch',
		passed: false,
		reach,
		sides: [
			buildSide('figures', translator.t('checks.sides.contributions'), unmatchedFigures.map(figureEntry)),
			buildSide('transactions', translator.t('checks.sides.transactions'), unmatchedTransactions.map((transaction) => {
				return transactionEntry(transaction);
			}))
		]
	};
};

const checkTradesMatch = (context: CheckContext, kind: TradeKind): CheckResult => {
	const { document, matching, translator, formatter } = context;
	const { transactionEntry, tradeEntry, tickerOf, accountName } = context.naming;
	const id: CheckId = kind === 'purchase' ? 'purchasesMatch' : 'salesMatch';
	const side = kind === 'purchase' ? matching.purchases : matching.sales;
	const count = tradesOfKind(document.trades, kind).length;
	const reach = translator.t(kind === 'purchase' ? 'checks.reach.purchases' : 'checks.reach.sales', { count });

	if(side.unmatchedTrades.length === 0 && side.unmatchedTransactions.length === 0) {
		return { id, passed: true, reach, sides: [] };
	}

	return {
		id,
		passed: false,
		reach,
		sides: [
			buildSide('transactions', translator.t('checks.sides.transactions'), side.unmatchedTransactions.map((transaction) => {
				return transactionEntry(transaction);
			})),
			buildSide('trades', translator.t(kind === 'purchase' ? 'checks.sides.purchases' : 'checks.sides.sales'), side.unmatchedTrades.map((trade) => {
				// The trade's own tables state its total; what is missing here is the bank row, so the entry states what that row carries
				return tradeEntry(trade, translator.t('checks.entries.tradeSettlement', {
					date: formatter.storedDate(trade.date),
					ticker: tickerOf(trade.securityId),
					account: accountName(trade.accountId),
					amount: formatter.amount(tradeSettlement(trade))
				}));
			}))
		]
	};
};

/**
 * Check 8. The running quantity of a (security, account) never drops below 0 **in the walk order of [§11.1]** — by date,
 * purchases before sales on a date they share.
 * @param context What the check reads.
 * @returns The result.
 */
const checkNoNegativeHolding = (context: CheckContext): CheckResult => {
	const { translator, formatter, walk } = context;
	const { tradeEntry, tickerOf, accountName } = context.naming;
	const reach = translator.t('checks.reach.positions', { count: walk.positions.size });

	// The trade that took each position negative, in the order the Sales table shows those trades in
	const broken: { securityId: LedgerId; accountId: LedgerId; trade: Trade }[] = [];

	for(const position of walk.positions.values()) {
		if(position.oversoldTrade) {
			broken.push({ securityId: position.securityId, accountId: position.accountId, trade: position.oversoldTrade });
		}
	}

	broken.sort((first, second) => {
		return compareTradesInWalkOrder(first.trade, second.trade);
	});

	if(broken.length === 0) {
		return { id: 'noNegativeHolding', passed: true, reach, sides: [] };
	}

	return {
		id: 'noNegativeHolding',
		passed: false,
		reach,
		sides: [ buildSide('positions', undefined, broken.map(({ securityId, accountId, trade }) => {
			return tradeEntry(trade, translator.t('checks.entries.oversold', {
				ticker: tickerOf(securityId),
				account: accountName(accountId),
				date: formatter.storedDate(trade.date),
				quantity: formatter.quantity(trade.quantity)
			}));
		})) ]
	};
};

/**
 * Check 9. **A purchase and a sale on one day satisfy it**: same-day round trips are ordinary, and the walk puts the purchase
 * first.
 * @param context What the check reads.
 * @returns The result.
 */
const checkNoSaleBeforePurchase = (context: CheckContext): CheckResult => {
	const { document, translator } = context;
	const { tradeEntry } = context.naming;
	const sales = sortTrades(tradesOfKind(document.trades, 'sale'));
	const purchases = tradesOfKind(document.trades, 'purchase');
	const reach = translator.t('checks.reach.sales', { count: sales.length });

	// The earliest purchase of each (security, account), which is the only thing a sale has to be dated on or after
	const earliestPurchase = new Map<string, IsoDate>();

	for(const purchase of purchases) {
		const key = `${purchase.securityId}|${purchase.accountId}`;
		const standing = earliestPurchase.get(key);

		if(standing === undefined || purchase.date < standing) {
			earliestPurchase.set(key, purchase.date);
		}
	}

	const orphaned = sales.filter((sale) => {
		const earliest = earliestPurchase.get(`${sale.securityId}|${sale.accountId}`);

		return earliest === undefined || earliest > sale.date;
	});

	if(orphaned.length === 0) {
		return { id: 'noSaleBeforePurchase', passed: true, reach, sides: [] };
	}

	return {
		id: 'noSaleBeforePurchase',
		passed: false,
		reach,
		sides: [ buildSide('sales', undefined, orphaned.map((sale) => {
			return tradeEntry(sale);
		})) ]
	};
};

/**
 * Check 10. **The one check that reads open accounts only**: what a closed pension fund still owes is an empty balance, and that
 * is check 11's question.
 * @param context What the check reads.
 * @returns The result.
 */
const checkPensionFundRevalued = (context: CheckContext): CheckResult => {
	const { document, preferences, translator, formatter, today } = context;
	const { accountName } = context.naming;
	const adjustmentIds = categoryIdsWithRole(document.categories, 'value-adjustment');

	const funds = sortAccounts(document.accounts.filter((account) => {
		return account.type === 'pension-fund' && !isAccountClosed(account);
	}), document.institutions);

	const reach = translator.t('checks.reach.pensionFunds', { count: funds.length });
	const threshold = addMonthsToIsoDate(today, -preferences.pensionRevaluationMonths);
	const entries: CheckEntry[] = [];

	for(const fund of funds) {
		const latest = document.transactions.filter((transaction) => {
			return transaction.accountId === fund.id &&
				transaction.categoryId !== null &&
				adjustmentIds.has(transaction.categoryId);
		}).reduce((standing: IsoDate | undefined, transaction) => {
			return standing === undefined || transaction.date > standing ? transaction.date : standing;
		}, undefined);

		if(latest !== undefined && latest >= threshold) {
			continue;
		}

		entries.push({
			key: fund.id,
			text: latest === undefined ?
				translator.t('checks.entries.neverRevalued', { account: accountName(fund.id) }) :
				translator.t('checks.entries.lastRevalued', { account: accountName(fund.id), date: formatter.storedDate(latest) }),
			link: { screen: 'accounts', accountId: fund.id }
		});
	}

	if(entries.length === 0) {
		return { id: 'pensionFundRevalued', passed: true, reach, sides: [] };
	}

	return { id: 'pensionFundRevalued', passed: false, reach, sides: [ buildSide('accounts', undefined, entries) ] };
};

/**
 * Check 11. **What it states is that nothing derivable is left in the account.**
 *
 * A cash account is empty when its opening balance and its transactions come to nothing; a brokerage account is empty when no
 * holding is derived in it. **An oversold position yields no holding at all**, so a brokerage account whose position went below
 * zero passes here — deliberately, checks 8 and 9 already failing on the same account and already naming the trade.
 * @param context What the check reads.
 * @returns The result.
 */
const checkClosedAccountsEmpty = (context: CheckContext): CheckResult => {
	const { document, translator, formatter, walk } = context;
	const { accountName } = context.naming;
	const closed = sortAccounts(document.accounts.filter(isAccountClosed), document.institutions);
	const reach = translator.t('checks.reach.closedAccounts', { count: closed.length });

	const balances = new Map<LedgerId, Cents>();

	for(const account of document.accounts) {
		balances.set(account.id, account.openingBalance);
	}

	for(const transaction of document.transactions) {
		const standing = balances.get(transaction.accountId);

		if(standing !== undefined) {
			balances.set(transaction.accountId, standing + transaction.amount);
		}
	}

	const heldQuantity = new Map<LedgerId, number>();

	for(const position of walk.positions.values()) {
		if(!position.oversold && position.quantity > 0) {
			heldQuantity.set(position.accountId, (heldQuantity.get(position.accountId) ?? 0) + position.quantity);
		}
	}

	const entries: CheckEntry[] = [];

	for(const account of closed) {
		const closingDate = formatter.storedDate(account.closingDate ?? '');

		if(account.type === 'brokerage') {
			const quantity = heldQuantity.get(account.id) ?? 0;

			if(quantity > 0) {
				entries.push({
					key: account.id,
					text: translator.t('checks.entries.closedAccountHolding', {
						account: accountName(account.id),
						date: closingDate,
						quantity: formatter.quantity(quantity)
					}),
					link: { screen: 'accounts', accountId: account.id }
				});
			}

			continue;
		}

		const balance = balances.get(account.id) ?? 0;

		if(balance !== 0) {
			entries.push({
				key: account.id,
				text: translator.t('checks.entries.closedAccountBalance', {
					account: accountName(account.id),
					date: closingDate,
					balance: formatter.amount(balance, true)
				}),
				link: { screen: 'accounts', accountId: account.id }
			});
		}
	}

	if(entries.length === 0) {
		return { id: 'closedAccountsEmpty', passed: true, reach, sides: [] };
	}

	return { id: 'closedAccountsEmpty', passed: false, reach, sides: [ buildSide('accounts', undefined, entries) ] };
};

/**
 * Check 12. **Both ends, not just the near one.**
 *
 * It names transactions and trades in one list rather than two, the two sides of [§9] being the unmatched halves of a pairing
 * and this check having no pairing in it. The transactions come first, each side in the order of its own screen.
 * @param context What the check reads.
 * @returns The result.
 */
const checkRecordsWithinAccountLife = (context: CheckContext): CheckResult => {
	const { document, translator, formatter, accounts } = context;
	const { transactionEntry, tradeEntry, tickerOf, accountName } = context.naming;
	const reach = translator.t('checks.reach.recordsAndTrades', {
		transactions: document.transactions.length,
		trades: document.trades.length
	});

	// What is wrong with the record: too early for the account, or too late for it
	const breach = (account: Account | undefined, date: IsoDate): { key: 'beforeOpening' | 'afterClosing'; boundary: IsoDate } | undefined => {
		if(!account) {
			return undefined;
		}

		if(date < account.openingDate) {
			return { key: 'beforeOpening', boundary: account.openingDate };
		}

		if(account.closingDate !== null && date > account.closingDate) {
			return { key: 'afterClosing', boundary: account.closingDate };
		}

		return undefined;
	};

	const entries: CheckEntry[] = [];

	for(const transaction of sortTransactions(document.transactions)) {
		const found = breach(accounts.get(transaction.accountId), transaction.date);

		if(found) {
			entries.push(transactionEntry(transaction, translator.t(`checks.entries.${found.key}`, {
				record: translator.t('checks.entries.transactionRecord', {
					date: formatter.storedDate(transaction.date),
					description: transaction.description
				}),
				account: accountName(transaction.accountId),
				boundary: formatter.storedDate(found.boundary)
			})));
		}
	}

	for(const trade of sortTrades(document.trades)) {
		const found = breach(accounts.get(trade.accountId), trade.date);

		if(found) {
			entries.push(tradeEntry(trade, translator.t(`checks.entries.${found.key}`, {
				record: translator.t('checks.entries.tradeRecord', {
					date: formatter.storedDate(trade.date),
					ticker: tickerOf(trade.securityId)
				}),
				account: accountName(trade.accountId),
				boundary: formatter.storedDate(found.boundary)
			})));
		}
	}

	if(entries.length === 0) {
		return { id: 'recordsWithinAccountLife', passed: true, reach, sides: [] };
	}

	return { id: 'recordsWithinAccountLife', passed: false, reach, sides: [ buildSide('records', undefined, entries) ] };
};

const checkReceiptTrackedHaveState = (context: CheckContext): CheckResult => {
	const { document, translator } = context;
	const { transactionEntry } = context.naming;
	const categories = indexCategories(document.categories);

	const tracked = document.transactions.filter((transaction) => {
		return transaction.categoryId !== null && (categories.get(transaction.categoryId)?.receiptTracked ?? false);
	});

	const reach = translator.t('checks.reach.trackedTransactions', { count: tracked.length });
	const untracked = sortTransactions(tracked.filter((transaction) => {
		return transaction.receiptState === 'na';
	}));

	if(untracked.length === 0) {
		return { id: 'receiptTrackedHaveState', passed: true, reach, sides: [] };
	}

	return {
		id: 'receiptTrackedHaveState',
		passed: false,
		reach,
		sides: [ buildSide('transactions', undefined, untracked.map((transaction) => {
			return transactionEntry(transaction);
		})) ]
	};
};

/**
 * Check 14. **It ages the transaction, not the flag**, there being no “pending since” field: a row from 2019 marked pending this
 * morning is overdue this morning.
 * @param context What the check reads.
 * @returns The result.
 */
const checkNoOverduePendingReceipt = (context: CheckContext): CheckResult => {
	const { document, preferences, translator, formatter, today } = context;
	const { accountName } = context.naming;

	const pending = sortTransactions(document.transactions.filter((transaction) => {
		return transaction.receiptState === 'pending';
	}));

	const reach = translator.t('checks.reach.pendingReceipts', { count: pending.length });
	const threshold = addMonthsToIsoDate(today, -preferences.receiptPendingMonths);

	const overdue = pending.filter((transaction) => {
		return transaction.date < threshold;
	});

	if(overdue.length === 0) {
		return { id: 'noOverduePendingReceipt', passed: true, reach, sides: [] };
	}

	return {
		id: 'noOverduePendingReceipt',
		passed: false,
		reach,
		sides: [ buildSide('transactions', undefined, overdue.map((transaction) => {
			return {
				key: transaction.id,
				text: translator.t('checks.entries.overdueReceipt', {
					date: formatter.storedDate(transaction.date),
					account: accountName(transaction.accountId),
					description: transaction.description,
					amount: formatter.amount(transaction.amount, true),
					count: daysBetweenIsoDates(transaction.date, today)
				}),
				link: { screen: 'transactions', accountId: transaction.accountId, date: transaction.date }
			};
		})) ]
	};
};

/**
 * The fourteen checks over a file.
 * @param options Everything a check reads.
 * @returns The fourteen results, always all of them and always in the order of the specification's table.
 */
export const runChecks = (options: ChecksOptions): CheckResult[] => {
	const accounts = new Map(options.document.accounts.map((account) => {
		return [ account.id, account ];
	}));

	const context: CheckContext = {
		...options,
		accounts,
		walk: walkPositions(options.document.trades),
		naming: buildNaming(options, accounts)
	};

	return [
		checkTransfersBalance(context),
		checkTransactionsCategorised(context),
		checkPricesRecent(context),
		checkPayslipsMatchSalaries(context),
		checkPensionContributionsMatch(context),
		checkTradesMatch(context, 'purchase'),
		checkTradesMatch(context, 'sale'),
		checkNoNegativeHolding(context),
		checkNoSaleBeforePurchase(context),
		checkPensionFundRevalued(context),
		checkClosedAccountsEmpty(context),
		checkRecordsWithinAccountLife(context),
		checkReceiptTrackedHaveState(context),
		checkNoOverduePendingReceipt(context)
	];
};

/**
 * How many of the fourteen are failing, which is what the sidebar badge counts.
 * **The badge is a count of failing checks** and never of the records they name between them.
 * @param results The fourteen results.
 * @returns How many failed.
 */
export const countFailingChecks = (results: readonly CheckResult[]): number => {
	return results.filter((result) => {
		return !result.passed;
	}).length;
};
