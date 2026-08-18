import { addDaysToIsoDate, firstDayOfMonth, lastDayOfNextMonth } from 'src/logic/checks/CheckDates';
import { compareNames, formatAccountName, indexInstitutions } from 'src/logic/accounts/Accounts';
import { categoryIdsWithRole } from 'src/logic/categories/Categories';
import { sortTrades, tradeTotal } from 'src/logic/investments/Trades';
import { formatPayslipPeriod } from 'src/logic/salaries/Payslips';
import { sortTransactions } from 'src/logic/transactions/Transactions';
import type { SpiccioliTranslator } from 'src/i18n/Translations';
import type {
	Category,
	Cents,
	Contract,
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
 * The five greedy pairings of [§11.6], and the one walk all of them are made of.
 *
 * **Nothing here is stored.** Matching is recomputed from the file every time, and the pairs it produces are what the *Matched*
 * columns name and what checks 1, 4, 5, 6 and 7 report the leftovers of.
 *
 * **No matcher compares absolute values.** Each pairing states whether its two figures are equal or exactly opposite and
 * compares them as they stand: opposite for a transfer's two legs and for a purchase against its trade, equal for a sale, a
 * salary payment and a pension credit.
 *
 * **Every one of them is greedy and every one of them states its order.** The side being matched *from* is walked in the
 * ordering its own screen uses — `date ASC, insertionSeq ASC, id ASC` for transactions and trades, year then month then label
 * for payslips — and each record claims the **nearest-dated** unclaimed counterpart that satisfies the conditions, ties broken
 * by that counterpart's `insertionSeq` and then its `id`. Nothing is left to iteration order, so the same file pairs the same
 * way on every machine.
 *
 * **Every window runs forwards only**: money leaves before it arrives, a trade is executed before it settles, and a month's pay
 * is earned before it is paid. The leading record opens the window and the bank's record of it falls inside.
 *
 * **Each side is bucketed by amount**, which is the intended implementation rather than an optimisation to reach for later: a
 * pairing keys off an amount and a date window, so the search for a counterpart is a lookup among the few records that could
 * possibly match and the run stays linear in the size of the file.
 */

/** One record the matching can pair *to*: the side being claimed. */
export interface MatchCandidate {
	id: LedgerId;
	date: IsoDate;
	insertionSeq: number;

	// Signed, exactly as it is stored. What relation it has to the claim is the claim's business.
	amount: Cents;
}

interface GreedyMatchOptions<TClaim> {

	// Already in the order the claims are walked in, which is the order of the screen the claiming side lives on
	claims: readonly TClaim[];

	candidates: readonly MatchCandidate[];

	// What tells two claims apart, and what the pairing is recorded under
	keyOf: (claim: TClaim) => string;

	// The signed figure a counterpart has to carry
	amountOf: (claim: TClaim) => Cents;

	// The window the counterpart has to fall in, both ends inclusive
	windowOf: (claim: TClaim) => { fromDate: IsoDate; toDate: IsoDate };

	// Everything else the pair has to satisfy: a different account, a shared institution
	accepts?: (claim: TClaim, candidate: MatchCandidate) => boolean;

	// Set only where the claiming side is itself part of the candidate list, which is the transfer legs and nothing else
	candidateIdOf?: (claim: TClaim) => LedgerId;
}

interface GreedyMatchResult<TClaim> {

	// The claim's key against the counterpart it claimed
	matches: Map<string, LedgerId>;

	unmatchedClaims: TClaim[];
	unmatchedCandidateIds: Set<LedgerId>;
}

/** The two legs of every transfer that paired, and the legs that did not. */
export interface TransferMatching {

	// Both ways round: each paired leg names the other
	counterparts: Map<LedgerId, LedgerId>;

	// Every leg that ended in no pair, in the transactions ordering
	unpaired: Transaction[];

	// How many legs were examined, which is what the check states when it passes
	legCount: number;
}

/** One kind of trade against the bank transactions that settled it. */
export interface TradeMatching {
	transactionByTrade: Map<LedgerId, LedgerId>;
	tradeByTransaction: Map<LedgerId, LedgerId>;

	// Both sides, each in the ordering of the screen it lives on
	unmatchedTrades: Trade[];
	unmatchedTransactions: Transaction[];
}

/** The payslips against the salary payments that paid them. */
export interface SalaryMatching {
	transactionByPayslip: Map<LedgerId, LedgerId>;
	payslipByTransaction: Map<LedgerId, Payslip>;
	unmatchedPayslips: Payslip[];
	unmatchedTransactions: Transaction[];
}

// Which of a payslip's three pension figures a claim is about, in the order they are walked in
export const PENSION_FIGURES = [ 'employee', 'employer', 'severance' ] as const;

export type PensionFigure = typeof PENSION_FIGURES[number];

/** One non-zero pension figure on one payslip: the thing a credit into the fund is paired against. */
export interface PensionClaim {
	payslip: Payslip;
	figure: PensionFigure;
	amount: Cents;
}

export interface PensionMatching {

	// Keyed by payslip and figure, a payslip having three of them
	transactionByFigure: Map<string, LedgerId>;

	figureByTransaction: Map<LedgerId, PensionClaim>;
	unmatchedFigures: PensionClaim[];
	unmatchedTransactions: Transaction[];
}

/** Everything the five matchers derived, which is what the checks report on and what the *Matched* columns name. */
export interface DerivedMatching {
	transfers: TransferMatching;
	purchases: TradeMatching;
	sales: TradeMatching;
	salaries: SalaryMatching;
	pension: PensionMatching;
}

export interface MatchingOptions {
	document: LedgerDocument;

	// The two windows are preferences, and both open on the leading record's date. Zero means same day only.
	preferences: Preferences;
}

/**
 * The key one of a payslip's three pension figures is claimed under.
 * @param payslipId The payslip.
 * @param figure Which of the three.
 * @returns The key.
 */
export const pensionFigureKey = (payslipId: LedgerId, figure: PensionFigure): string => {
	return `${payslipId}|${figure}`;
};

/**
 * What a payslip carries under each of the three pension headings.
 * @param payslip The payslip.
 * @param figure Which of the three.
 * @returns The figure, a magnitude of zero or more.
 */
export const pensionFigureAmount = (payslip: Payslip, figure: PensionFigure): Cents => {
	switch(figure) {
		case 'employer':
			return payslip.employerContribution;
		case 'severance':
			return payslip.severanceContribution;
		case 'employee':
		default:
			return payslip.employeeContribution;
	}
};

/**
 * Orders two candidates the way “nearest-dated” is decided: by date, then by the counterpart's `insertionSeq`, then by its `id`.
 * @param first The first candidate.
 * @param second The second candidate.
 * @returns Negative when the first is nearer, positive when the second is.
 */
const compareCandidates = (first: MatchCandidate, second: MatchCandidate): number => {
	if(first.date !== second.date) {
		return first.date < second.date ? -1 : 1;
	}

	if(first.insertionSeq !== second.insertionSeq) {
		return first.insertionSeq - second.insertionSeq;
	}

	return first.id < second.id ? -1 : 1;
};

/**
 * The one walk every pairing below is made of: each claim, in the order it was handed over, takes the nearest-dated unclaimed
 * counterpart carrying the amount it is looking for inside the window it is looking in.
 *
 * **The candidates are bucketed by amount and each bucket is ordered**, so a claim looks at the few records that could possibly
 * match it rather than at the file. Every window opens forwards, so the nearest candidate is the earliest one in the bucket that
 * has not been taken.
 * @param options What is being matched against what.
 * @returns The pairs, and what was left on each side.
 */
const runGreedyMatching = <TClaim>(options: GreedyMatchOptions<TClaim>): GreedyMatchResult<TClaim> => {
	const { claims, candidates, keyOf, amountOf, windowOf, accepts, candidateIdOf } = options;
	const buckets = new Map<Cents, MatchCandidate[]>();

	for(const candidate of candidates) {
		const bucket = buckets.get(candidate.amount);

		if(bucket) {
			bucket.push(candidate);
		}
		else {
			buckets.set(candidate.amount, [ candidate ]);
		}
	}

	for(const bucket of buckets.values()) {
		bucket.sort(compareCandidates);
	}

	const matches = new Map<string, LedgerId>();
	const unmatchedClaims: TClaim[] = [];
	const claimed = new Set<LedgerId>();

	for(const claim of claims) {
		const ownId = candidateIdOf?.(claim);

		// A leg the other side of the walk already paired with takes no further part: it is matched, from the other end
		if(ownId !== undefined && claimed.has(ownId)) {
			continue;
		}

		const { fromDate, toDate } = windowOf(claim);
		const bucket = buckets.get(amountOf(claim)) ?? [];
		const counterpart = bucket.find((candidate) => {
			return candidate.date >= fromDate &&
				candidate.date <= toDate &&
				candidate.id !== ownId &&
				!claimed.has(candidate.id) &&
				(accepts?.(claim, candidate) ?? true);
		});

		if(!counterpart) {
			unmatchedClaims.push(claim);

			continue;
		}

		matches.set(keyOf(claim), counterpart.id);
		claimed.add(counterpart.id);

		if(ownId !== undefined) {
			claimed.add(ownId);
		}
	}

	const unmatchedCandidateIds = new Set(candidates.filter((candidate) => {
		return !claimed.has(candidate.id);
	}).map((candidate) => {
		return candidate.id;
	}));

	return { matches, unmatchedClaims, unmatchedCandidateIds };
};

const toCandidate = (transaction: Transaction): MatchCandidate => {
	return {
		id: transaction.id,
		date: transaction.date,
		insertionSeq: transaction.insertionSeq,
		amount: transaction.amount
	};
};

const transactionsInRole = (document: LedgerDocument, role: Category['role']): Transaction[] => {
	if(role === null) {
		return [];
	}

	const categoryIds = categoryIdsWithRole(document.categories, role);

	return sortTransactions(document.transactions.filter((transaction) => {
		return transaction.categoryId !== null && categoryIds.has(transaction.categoryId);
	}));
};

/**
 * Pairs the two legs of every internal transfer: exactly opposite amounts, different accounts, and the receiving leg dated on or
 * after the sending one inside the window.
 *
 * **The negative legs are what is walked**, each claiming the nearest-dated unclaimed positive leg in its window. **A leg of
 * zero is on both sides of that sentence** — it is neither a sending leg nor a receiving one, and its own opposite — so it is
 * walked like a sending leg and claimed like a receiving one, which pairs two zero legs on two accounts and leaves a lone one
 * reported. That is the one reading the specification's *negative* and *positive* need, a zero amount being legal everywhere.
 * @param document The ledger.
 * @param windowDays How many days after the sending leg the receiving one may be dated. Zero is same day only.
 * @returns The pairs, and every leg that has none.
 */
export const matchInternalTransfers = (document: LedgerDocument, windowDays: number): TransferMatching => {
	const legs = transactionsInRole(document, 'internal-transfer');

	const sending = legs.filter((leg) => {
		return leg.amount <= 0;
	});
	const receiving = legs.filter((leg) => {
		return leg.amount >= 0;
	}).map(toCandidate);

	const byId = new Map(legs.map((leg) => {
		return [ leg.id, leg ];
	}));

	const { matches } = runGreedyMatching<Transaction>({
		claims: sending,
		candidates: receiving,
		keyOf: (leg) => {
			return leg.id;
		},
		amountOf: (leg) => {
			return -leg.amount;
		},
		windowOf: (leg) => {
			return { fromDate: leg.date, toDate: addDaysToIsoDate(leg.date, windowDays) };
		},
		accepts: (leg, candidate) => {
			return byId.get(candidate.id)?.accountId !== leg.accountId;
		},
		candidateIdOf: (leg) => {
			return leg.id;
		}
	});

	const counterparts = new Map<LedgerId, LedgerId>();

	for(const [ sendingId, receivingId ] of matches) {
		counterparts.set(sendingId, receivingId);
		counterparts.set(receivingId, sendingId);
	}

	// A zero leg is walked and offered, so it can turn up on both leftover lists; the pair itself is what says it is paired
	const unpaired = legs.filter((leg) => {
		return !counterparts.has(leg.id);
	});

	return { counterparts, unpaired, legCount: legs.length };
};

/**
 * Pairs one kind of trade against the bank transactions that settled it.
 *
 * **The trade leads, because a trade is executed before it settles**: the cash moves a day or two later on a purchase and on a
 * sale alike. The money leaves the cash account on a purchase, so the transaction is the negation of the trade total; it arrives
 * on a sale, so the two are equal.
 *
 * **The two sides sit in different accounts by construction**, the trade in a brokerage account and the money in a cash one, so
 * the pairing keys off the institution they share. A `Cash` account is the only one that can lack an institution, and it
 * therefore never pairs.
 * @param document The ledger.
 * @param kind Which of the two tables is being paired.
 * @param windowDays How many days after the trade the transaction may be dated. Zero is same day only.
 * @returns The pairs, and what is left on either side.
 */
export const matchTradesToTransactions = (document: LedgerDocument, kind: TradeKind, windowDays: number): TradeMatching => {
	const trades = sortTrades(document.trades.filter((trade) => {
		return trade.kind === kind;
	}));

	const transactions = transactionsInRole(document, kind === 'purchase' ? 'securities-purchase' : 'securities-sale');
	const accounts = new Map(document.accounts.map((account) => {
		return [ account.id, account ];
	}));
	const transactionsById = new Map(transactions.map((transaction) => {
		return [ transaction.id, transaction ];
	}));

	const institutionOf = (accountId: LedgerId): LedgerId | null => {
		return accounts.get(accountId)?.institutionId ?? null;
	};

	const { matches, unmatchedClaims, unmatchedCandidateIds } = runGreedyMatching<Trade>({
		claims: trades,
		candidates: transactions.map(toCandidate),
		keyOf: (trade) => {
			return trade.id;
		},
		amountOf: (trade) => {
			return kind === 'purchase' ? -tradeTotal(trade) : tradeTotal(trade);
		},
		windowOf: (trade) => {
			return { fromDate: trade.date, toDate: addDaysToIsoDate(trade.date, windowDays) };
		},
		accepts: (trade, candidate) => {
			const transaction = transactionsById.get(candidate.id);
			const institutionId = institutionOf(trade.accountId);

			return institutionId !== null && transaction !== undefined && institutionOf(transaction.accountId) === institutionId;
		}
	});

	const tradeByTransaction = new Map<LedgerId, LedgerId>();

	for(const [ tradeId, transactionId ] of matches) {
		tradeByTransaction.set(transactionId, tradeId);
	}

	return {
		transactionByTrade: matches,
		tradeByTransaction,
		unmatchedTrades: unmatchedClaims,
		unmatchedTransactions: transactions.filter((transaction) => {
			return unmatchedCandidateIds.has(transaction.id);
		})
	};
};

/**
 * Orders the payslips the way both payslip walks reach them: year, then month, then label with the unlabelled one first, then
 * the contract's name.
 *
 * **The payslips of every contract are walked together, because a transaction has no employer on it.** Two employers paying an
 * identical net amount in one month can therefore have their two links crossed; both still pair, and the only thing that is
 * wrong is which of two identical rows the *Matched* column names.
 * @param payslips The payslips.
 * @param contracts The contracts, which break the last tie by name.
 * @returns The payslips, in the walk order.
 */
export const sortPayslipsForMatching = (payslips: readonly Payslip[], contracts: readonly Contract[]): Payslip[] => {
	const contractNames = new Map(contracts.map((contract) => {
		return [ contract.id, contract.name ];
	}));

	return [ ...payslips ].sort((first, second) => {
		if(first.year !== second.year) {
			return first.year - second.year;
		}

		if(first.month !== second.month) {
			return first.month - second.month;
		}

		const firstLabel = first.label ?? '';
		const secondLabel = second.label ?? '';

		if(firstLabel !== secondLabel) {
			// The unlabelled payslip is first, an empty label sorting before every other one
			return firstLabel < secondLabel ? -1 : 1;
		}

		const byContract = compareNames(contractNames.get(first.contractId) ?? '', contractNames.get(second.contractId) ?? '');

		if(byContract !== 0) {
			return byContract;
		}

		return first.id < second.id ? -1 : 1;
	});
};

// The window a payslip's figures are paid in: its own month, or the one after it
const payslipWindow = (payslip: Payslip): { fromDate: IsoDate; toDate: IsoDate } => {
	return {
		fromDate: firstDayOfMonth(payslip.year, payslip.month),
		toDate: lastDayOfNextMonth(payslip.year, payslip.month)
	};
};

/**
 * Pairs each payslip with the salary payment that paid it: the same signed amount, in the payslip's own month or the one after.
 *
 * **A payslip has no date, so “nearest” is measured from the first day of its own month**, which among two candidates takes the
 * earlier one. **A `netPayment` of zero pairs like any other figure, and so does a negative one**: nothing here special-cases a
 * sign, and a negative payslip whose debt the employer carried rather than recovering simply has no transaction to pair with.
 * @param document The ledger.
 * @returns The pairs, and what is left on either side.
 */
export const matchPayslipsToSalaries = (document: LedgerDocument): SalaryMatching => {
	const payslips = sortPayslipsForMatching(document.payslips, document.contracts);
	const transactions = transactionsInRole(document, 'salary');

	const { matches, unmatchedClaims, unmatchedCandidateIds } = runGreedyMatching<Payslip>({
		claims: payslips,
		candidates: transactions.map(toCandidate),
		keyOf: (payslip) => {
			return payslip.id;
		},
		amountOf: (payslip) => {
			return payslip.netPayment;
		},
		windowOf: payslipWindow
	});

	const payslipByTransaction = new Map<LedgerId, Payslip>();
	const payslipsById = new Map(payslips.map((payslip) => {
		return [ payslip.id, payslip ];
	}));

	for(const [ payslipId, transactionId ] of matches) {
		const payslip = payslipsById.get(payslipId);

		if(payslip) {
			payslipByTransaction.set(transactionId, payslip);
		}
	}

	return {
		transactionByPayslip: matches,
		payslipByTransaction,
		unmatchedPayslips: unmatchedClaims,
		unmatchedTransactions: transactions.filter((transaction) => {
			return unmatchedCandidateIds.has(transaction.id);
		})
	};
};

/**
 * Pairs each non-zero pension figure on each payslip with the credit into the fund that carried it.
 *
 * **A figure of 0 is not a claim.** It expects no credit, takes no part in the walk and cannot be reported as unmatched: a
 * heading a payslip has nothing under is not a credit that failed to arrive.
 *
 * **The three figures are walked employee, then employer, then severance**, within a payslip walked in the payslip order. Two of
 * them being equal costs nothing: both pair, and the only thing that can be wrong is which of two identical credits the
 * *Matched* column names.
 * @param document The ledger.
 * @returns The pairs, and what is left on either side.
 */
export const matchPensionContributions = (document: LedgerDocument): PensionMatching => {
	const payslips = sortPayslipsForMatching(document.payslips, document.contracts);
	const transactions = transactionsInRole(document, 'pension-contribution');
	const claims: PensionClaim[] = [];

	for(const payslip of payslips) {
		for(const figure of PENSION_FIGURES) {
			const amount = pensionFigureAmount(payslip, figure);

			if(amount !== 0) {
				claims.push({ payslip, figure, amount });
			}
		}
	}

	const { matches, unmatchedClaims, unmatchedCandidateIds } = runGreedyMatching<PensionClaim>({
		claims,
		candidates: transactions.map(toCandidate),
		keyOf: (claim) => {
			return pensionFigureKey(claim.payslip.id, claim.figure);
		},
		amountOf: (claim) => {
			return claim.amount;
		},
		windowOf: (claim) => {
			return payslipWindow(claim.payslip);
		}
	});

	const figureByTransaction = new Map<LedgerId, PensionClaim>();
	const claimsByKey = new Map(claims.map((claim) => {
		return [ pensionFigureKey(claim.payslip.id, claim.figure), claim ];
	}));

	for(const [ key, transactionId ] of matches) {
		const claim = claimsByKey.get(key);

		if(claim) {
			figureByTransaction.set(transactionId, claim);
		}
	}

	return {
		transactionByFigure: matches,
		figureByTransaction,
		unmatchedFigures: unmatchedClaims,
		unmatchedTransactions: transactions.filter((transaction) => {
			return unmatchedCandidateIds.has(transaction.id);
		})
	};
};

/**
 * Runs all five pairings over a file.
 * @param options What is being matched.
 * @param options.document The ledger.
 * @param options.preferences The two windows, which are preferences.
 * @returns Everything the five matchers derived.
 */
export const deriveMatching = ({ document, preferences }: MatchingOptions): DerivedMatching => {
	return {
		transfers: matchInternalTransfers(document, preferences.transferMatchWindowDays),
		purchases: matchTradesToTransactions(document, 'purchase', preferences.tradeMatchWindowDays),
		sales: matchTradesToTransactions(document, 'sale', preferences.tradeMatchWindowDays),
		salaries: matchPayslipsToSalaries(document),
		pension: matchPensionContributions(document)
	};
};

export interface MatchedNamesOptions {
	document: LedgerDocument;
	matching: DerivedMatching;

	// The wording a counterpart account and a payslip's period are written with
	translator: SpiccioliTranslator;
}

/**
 * What the *Matched* column of [§5.1] names on each transaction, which is the counterpart of **every** kind of pairing there is:
 * the counterpart account for a paired internal transfer, the security for a trade-matched securities transaction, and the
 * payslip — its month and its label — for a salary payment or a pension credit paired with one.
 *
 * A transaction with no entry here is one nothing paired with, and its cell reads an em dash.
 * @param options What was matched, and the wording it is written with.
 * @param options.document The ledger.
 * @param options.matching The five pairings.
 * @param options.translator The wording.
 * @returns One entry per paired transaction.
 */
export const describeMatchedTransactions = ({ document, matching, translator }: MatchedNamesOptions): Map<LedgerId, string> => {
	const institutions = indexInstitutions(document.institutions);
	const accounts = new Map(document.accounts.map((account) => {
		return [ account.id, account ];
	}));
	const transactions = new Map(document.transactions.map((transaction) => {
		return [ transaction.id, transaction ];
	}));
	const securities = new Map(document.securities.map((security) => {
		return [ security.id, security.ticker ];
	}));
	const trades = new Map(document.trades.map((trade) => {
		return [ trade.id, trade ];
	}));

	const names = new Map<LedgerId, string>();

	for(const [ transactionId, counterpartId ] of matching.transfers.counterparts) {
		const counterpart = transactions.get(counterpartId);
		const account = counterpart ? accounts.get(counterpart.accountId) : undefined;

		if(account) {
			names.set(transactionId, formatAccountName(account, institutions, translator));
		}
	}

	for(const side of [ matching.purchases, matching.sales ]) {
		for(const [ transactionId, tradeId ] of side.tradeByTransaction) {
			const trade = trades.get(tradeId);
			const ticker = trade ? securities.get(trade.securityId) : undefined;

			if(ticker !== undefined) {
				names.set(transactionId, ticker);
			}
		}
	}

	for(const [ transactionId, payslip ] of matching.salaries.payslipByTransaction) {
		names.set(transactionId, formatPayslipPeriod(payslip, translator));
	}

	for(const [ transactionId, claim ] of matching.pension.figureByTransaction) {
		names.set(transactionId, formatPayslipPeriod(claim.payslip, translator));
	}

	return names;
};

/**
 * The date of the bank transaction each trade was paired with, which is what the *Matched* column of [§7.2] shows.
 * A trade with no entry here is what checks 6 and 7 report, and its cell reads an em dash.
 * @param document The ledger.
 * @param matching The five pairings.
 * @returns One stored day per paired trade.
 */
export const matchedTradeDates = (document: LedgerDocument, matching: DerivedMatching): Map<LedgerId, IsoDate> => {
	const transactions = new Map(document.transactions.map((transaction) => {
		return [ transaction.id, transaction.date ];
	}));

	const dates = new Map<LedgerId, IsoDate>();

	for(const side of [ matching.purchases, matching.sales ]) {
		for(const [ tradeId, transactionId ] of side.transactionByTrade) {
			const date = transactions.get(transactionId);

			if(date !== undefined) {
				dates.set(tradeId, date);
			}
		}
	}

	return dates;
};
