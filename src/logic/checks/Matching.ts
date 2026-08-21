import { addDaysToIsoDate, daysBetweenIsoDates, firstDayOfMonth, lastDayOfNextMonth } from 'src/logic/checks/CheckDates';
import { compareNames, formatAccountName, indexInstitutions } from 'src/logic/accounts/Accounts';
import { categoryIdsWithRole } from 'src/logic/categories/Categories';
import { sortTrades, tradeSettlement } from 'src/logic/investments/Trades';
import { formatMonthOfYear, formatPayslipPeriod } from 'src/logic/salaries/Payslips';
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
 * The five pairings of [§11.6], and the one walk all of them are made of.
 *
 * **Nothing here is stored.** Matching is recomputed from the file every time, and the pairs it produces are what the *Matched*
 * columns name and what checks 1, 4, 5, 6 and 7 report the leftovers of.
 *
 * **No matcher compares absolute values.** Each pairing states whether its two figures are equal or exactly opposite and
 * compares them as they stand: opposite for a transfer's two legs and for a purchase against its trade, equal for a sale, a
 * salary payment and a pension credit.
 *
 * **Every one of them is one-to-one and every one of them states its order.** The side being matched *from* is walked in the
 * ascending ordering of its own records — `date ASC, insertionSeq ASC, id ASC` for transactions and trades, year then month then label
 * for payslips — and each record claims the **nearest-dated** free counterpart that satisfies the conditions, ties broken
 * by that counterpart's `insertionSeq` and then its `id`. Nothing is left to iteration order, so the same file pairs the same
 * way on every machine.
 *
 * **A claim that finds every eligible counterpart taken displaces one**, provided the record holding it can pair elsewhere — a
 * search that follows the same rule, so one displacement runs down a chain. What comes out is therefore the greatest number of
 * pairs the conditions admit, and a record is reported by its check only when there was no counterpart it could have had.
 *
 * **Every window but the transfer's runs forwards only**: money leaves before it arrives, a trade is executed before it settles,
 * and a month's pay is earned before it is paid, so the leading record opens the window and the bank's record of it falls inside.
 * **The transfer window reaches backwards as well**, by a preference of its own, because neither leg is the event: both are one
 * bank's record of it, and two banks date one movement differently.
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

interface OneToOneMatchOptions<TClaim> {

	// Already in the order the claims are walked in, which is the ascending ordering of the claiming side's own records
	claims: readonly TClaim[];

	candidates: readonly MatchCandidate[];

	// What tells two claims apart, and what the pairing is recorded under
	keyOf: (claim: TClaim) => string;

	// The signed figure a counterpart has to carry
	amountOf: (claim: TClaim) => Cents;

	// The window the counterpart has to fall in, both ends inclusive
	windowOf: (claim: TClaim) => { fromDate: IsoDate; toDate: IsoDate };

	// The day distances are measured from, which is the leading record's own. Defaults to the day the window opens on, the two
	// being the same wherever the window only runs forwards.
	pivotOf?: (claim: TClaim) => IsoDate;

	// Everything else the pair has to satisfy: a different account, a shared institution
	accepts?: (claim: TClaim, candidate: MatchCandidate) => boolean;

	// Set only where the claiming side is itself part of the candidate list, which is the transfer legs and nothing else
	candidateIdOf?: (claim: TClaim) => LedgerId;
}

interface OneToOneMatchResult<TClaim> {

	// The claim's key against the counterpart it claimed
	matches: Map<string, LedgerId>;

	unmatchedClaims: TClaim[];
	unmatchedCandidateIds: Set<LedgerId>;
}

/** How far either way the receiving leg of a transfer may be dated from the sending one. */
export interface TransferMatchWindow {

	// How many days after the sending leg the receiving one may be dated. Zero is same day only.
	forwardDays: number;

	// How many days before it the receiving leg may be dated, two banks dating one movement differently. Zero is forwards only.
	backwardDays: number;
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

// Which of a period's three pension figures a claim is about, in the order they are walked in
export const PENSION_FIGURES = [ 'employee', 'employer', 'severance' ] as const;

export type PensionFigure = typeof PENSION_FIGURES[number];

/**
 * One contribution period of one contract: the payslips a single credit into the fund is paid on.
 *
 * **The months are the calendar's and not the payslips'.** A period runs from `startMonth` to `endMonth` whatever falls inside
 * it, so a contract that ended in February still holds a period running to March and is still paid on in April.
 */
export interface PensionPeriod {
	contractId: LedgerId;
	year: number;
	startMonth: number;
	endMonth: number;

	// Every payslip of that contract whose month falls in the period, in the walk order of [§11.6]
	payslips: Payslip[];
}

/** One non-zero pension figure of one period: the thing a credit into the fund is paired against. */
export interface PensionClaim {
	period: PensionPeriod;
	figure: PensionFigure;
	amount: Cents;
}

export interface PensionMatching {

	// Keyed by period and figure, a period having three of them
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

	// The windows are preferences, and every one of them opens on the leading record's date. Zero means same day only.
	preferences: Preferences;
}

/**
 * The key one contribution period is held under: its contract, its year and the month it opens on.
 * @param period The period.
 * @returns The key.
 */
export const pensionPeriodKey = (period: PensionPeriod): string => {
	return `${period.contractId}|${period.year}|${period.startMonth}`;
};

/**
 * The key one of a period's three pension figures is claimed under.
 * @param period The period.
 * @param figure Which of the three.
 * @returns The key.
 */
export const pensionFigureKey = (period: PensionPeriod, figure: PensionFigure): string => {
	return `${pensionPeriodKey(period)}|${figure}`;
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
 * What a whole contribution period carries under one heading, which is the figure a credit into the fund is compared against.
 * @param period The period.
 * @param figure Which of the three.
 * @returns The sum over the period's payslips, a magnitude of zero or more.
 */
export const pensionPeriodAmount = (period: PensionPeriod, figure: PensionFigure): Cents => {
	return period.payslips.reduce((running, payslip) => {
		return running + pensionFigureAmount(payslip, figure);
	}, 0);
};

/**
 * Writes the months a contribution period covers, which is how a credit into the fund is named in the *Matched* column of
 * [§5.1] and in everything check 5 reports.
 *
 * **A period of one month reads as that month alone**, exactly as a payslip does, so the monthly case is written the way it
 * always was. A longer one reads as its two ends.
 * @param period The period.
 * @param translator The wording the months are written and joined with.
 * @returns The period, in one string.
 */
export const formatPensionPeriod = (period: PensionPeriod, translator: SpiccioliTranslator): string => {
	const from = formatMonthOfYear(period.year, period.startMonth, translator);

	if(period.startMonth === period.endMonth) {
		return from;
	}

	return translator.t('payslips.periodRange', { from, to: formatMonthOfYear(period.year, period.endMonth, translator) });
};

/**
 * Orders two candidates the way a bucket is held: by date, then by `insertionSeq`, then by `id`.
 * @param first The first candidate.
 * @param second The second candidate.
 * @returns Negative when the first comes earlier, positive when the second does.
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
 * Orders the counterparts one claim may take the way “nearest-dated” is decided once a window can reach both ways: by how many
 * days separate them from the leading record, then — two of them being equally far on either side — the **later** one first,
 * forwards being the direction the events themselves run in, then by `insertionSeq` and by `id` as everywhere else.
 *
 * On a window that only runs forwards this is the bucket's own order, so nothing about the other four pairings changes.
 * @param eligible The counterparts inside the claim's window, in the bucket's order.
 * @param pivotDate The leading record's day, which is what the distances are measured from.
 * @returns The same counterparts, nearest first.
 */
const orderByDistance = (eligible: readonly MatchCandidate[], pivotDate: IsoDate): MatchCandidate[] => {
	return eligible.map((candidate) => {
		return { candidate, distance: Math.abs(daysBetweenIsoDates(pivotDate, candidate.date)) };
	}).sort((first, second) => {
		if(first.distance !== second.distance) {
			return first.distance - second.distance;
		}

		// Equally far on either side of the pivot: the later day is the one the window runs towards
		if(first.candidate.date !== second.candidate.date) {
			return first.candidate.date < second.candidate.date ? 1 : -1;
		}

		return compareCandidates(first.candidate, second.candidate);
	}).map((entry) => {
		return entry.candidate;
	});
};

/**
 * The one walk every pairing below is made of: each claim, in the order it was handed over, takes the nearest-dated free
 * counterpart carrying the amount it is looking for inside the window it is looking in.
 *
 * **The candidates are bucketed by amount**, so a claim looks at the few records that could possibly match it rather than at the
 * file, and each claim's own shortlist is then ordered nearest first.
 *
 * **A claim whose every counterpart is taken displaces one rather than stranding**, provided the claim holding it can pair
 * elsewhere — which is asked in exactly the same way, so a displacement runs down a chain and is undone whole when the chain
 * ends nowhere. Both sides are walked in fixed orders and the search is depth-first over them, so the pairing is deterministic;
 * what it adds over taking the first fit is that no pair the conditions admit is thrown away by the order the claims arrived in.
 * @param options What is being matched against what.
 * @returns The pairs, and what was left on each side.
 */
const runOneToOneMatching = <TClaim>(options: OneToOneMatchOptions<TClaim>): OneToOneMatchResult<TClaim> => {
	const { claims, candidates, keyOf, amountOf, windowOf, pivotOf, accepts, candidateIdOf } = options;
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

	// Every counterpart one claim may take, nearest first. What is left to decide is only which of them it ends up with.
	const shortlists = claims.map((claim) => {
		const { fromDate, toDate } = windowOf(claim);
		const ownId = candidateIdOf?.(claim);

		return orderByDistance((buckets.get(amountOf(claim)) ?? []).filter((candidate) => {
			return candidate.date >= fromDate &&
				candidate.date <= toDate &&
				candidate.id !== ownId &&
				(accepts?.(claim, candidate) ?? true);
		}), pivotOf?.(claim) ?? fromDate);
	});

	const matches = new Map<string, LedgerId>();
	const unmatchedClaims: TClaim[] = [];

	// Which claim holds each counterpart, which is what a displacement rewrites
	const holderByCandidate = new Map<LedgerId, number>();

	// The claims that are themselves candidates and have paired. A leg that pairs is spent on both sides of the walk.
	const spent = new Set<LedgerId>();

	/**
	 * Finds one claim a counterpart: the nearest one nobody holds, and only when there is no such thing the nearest one whose
	 * holder can be moved elsewhere.
	 * @param index The claim.
	 * @param visited The counterparts this search has already offered, which is what keeps a chain from circling.
	 * @returns Whether the claim, and everything it displaced, ended up paired.
	 */
	const takeCounterpart = (index: number, visited: Set<LedgerId>): boolean => {
		const shortlist = shortlists[index];
		const available = (candidate: MatchCandidate): boolean => {
			return !visited.has(candidate.id) && !spent.has(candidate.id);
		};

		const free = shortlist.find((candidate) => {
			return available(candidate) && !holderByCandidate.has(candidate.id);
		});

		if(free) {
			visited.add(free.id);
			holderByCandidate.set(free.id, index);

			return true;
		}

		// Every counterpart it could have is held, so the nearest holder is asked to move, and the one after it if it will not
		for(const candidate of shortlist) {
			if(!available(candidate)) {
				continue;
			}

			visited.add(candidate.id);

			const holder = holderByCandidate.get(candidate.id);

			if(holder !== undefined && takeCounterpart(holder, visited)) {
				holderByCandidate.set(candidate.id, index);

				return true;
			}
		}

		return false;
	};

	claims.forEach((claim, index) => {
		const ownId = candidateIdOf?.(claim);

		// A leg the other side of the walk already paired with takes no further part: it is matched, from the other end
		if(ownId !== undefined && holderByCandidate.has(ownId)) {
			return;
		}

		if(!takeCounterpart(index, new Set())) {
			unmatchedClaims.push(claim);

			return;
		}

		if(ownId !== undefined) {
			spent.add(ownId);
		}
	});

	// Read back in the order the claims were walked in, so the pairs come out in it rather than in the order they were found
	const takenByClaim = new Map<number, LedgerId>();

	for(const [ candidateId, index ] of holderByCandidate) {
		takenByClaim.set(index, candidateId);
	}

	claims.forEach((claim, index) => {
		const counterpartId = takenByClaim.get(index);

		if(counterpartId !== undefined) {
			matches.set(keyOf(claim), counterpartId);
		}
	});

	const unmatchedCandidateIds = new Set(candidates.filter((candidate) => {
		return !holderByCandidate.has(candidate.id) && !spent.has(candidate.id);
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
 * Pairs the two legs of every internal transfer: exactly opposite amounts, different accounts, and the receiving leg dated
 * inside the window either side of the sending one.
 *
 * **This is the one window that reaches backwards**, because neither leg is the event: both are one bank's record of it, and a
 * bank posting the credit on the operation date against a bank posting the debit on its value date puts the receiving leg first
 * with nothing wrong in the file. The reach is short and is a preference of its own, `0` being the forward-only rule exactly.
 *
 * **The negative legs are what is walked**, each claiming the nearest-dated free positive leg in its window. **A leg of
 * zero is on both sides of that sentence** — it is neither a sending leg nor a receiving one, and its own opposite — so it is
 * walked like a sending leg and claimed like a receiving one, which pairs two zero legs on two accounts and leaves a lone one
 * reported. That is the one reading the specification's *negative* and *positive* need, a zero amount being legal everywhere.
 * **It is also the one place the walk can leave a pair on the table**: a zero leg claimed from the other end takes no further
 * part, so a displacement that later frees it does not bring it back. Nothing else here is on both sides of its own walk.
 * @param document The ledger.
 * @param window How far either way the receiving leg may be dated from the sending one.
 * @returns The pairs, and every leg that has none.
 */
export const matchInternalTransfers = (document: LedgerDocument, window: TransferMatchWindow): TransferMatching => {
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

	const { matches } = runOneToOneMatching<Transaction>({
		claims: sending,
		candidates: receiving,
		keyOf: (leg) => {
			return leg.id;
		},
		amountOf: (leg) => {
			return -leg.amount;
		},
		windowOf: (leg) => {
			return {
				fromDate: addDaysToIsoDate(leg.date, -window.backwardDays),
				toDate: addDaysToIsoDate(leg.date, window.forwardDays)
			};
		},
		pivotOf: (leg) => {
			return leg.date;
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
 * sale alike. The money leaves the cash account on a purchase, so the transaction is the negation of the settlement figure; it
 * arrives on a sale, so the two are equal.
 *
 * **What is compared is the trade without its commission**, a commission always being its own transaction in a role `bank fees`
 * category and never part of the line the bank prints for the trade itself.
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

	const { matches, unmatchedClaims, unmatchedCandidateIds } = runOneToOneMatching<Trade>({
		claims: trades,
		candidates: transactions.map(toCandidate),
		keyOf: (trade) => {
			return trade.id;
		},
		amountOf: (trade) => {
			return kind === 'purchase' ? -tradeSettlement(trade) : tradeSettlement(trade);
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

	const { matches, unmatchedClaims, unmatchedCandidateIds } = runOneToOneMatching<Payslip>({
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
 * The month a contribution period opens on, periods being anchored to the start of the year.
 * @param month The month a payslip is for, from 1.
 * @param months How many months one period is long, which divides 12.
 * @returns The first month of the period that month falls in.
 */
const periodStartMonth = (month: number, months: number): number => {
	return Math.floor((month - 1) / months) * months + 1;
};

/**
 * Groups payslips into the contribution periods the fund pays on: one period per contract, per year, per block of months.
 *
 * **A period holds every payslip of its contract inside it**, a *tredicesima* sharing its month with an ordinary payslip
 * included: the fund pays on the period as a whole rather than on one payslip at a time.
 * @param payslips The payslips, already in the walk order of [§11.6].
 * @param months How many months one period is long.
 * @returns The periods, in the order of the earliest payslip each one holds.
 */
export const groupPayslipsIntoPeriods = (payslips: readonly Payslip[], months: number): PensionPeriod[] => {
	const periods = new Map<string, PensionPeriod>();

	for(const payslip of payslips) {
		const startMonth = periodStartMonth(payslip.month, months);
		const period: PensionPeriod = {
			contractId: payslip.contractId,
			year: payslip.year,
			startMonth,
			endMonth: startMonth + months - 1,
			payslips: []
		};

		const existing = periods.get(pensionPeriodKey(period));

		if(existing) {
			existing.payslips.push(payslip);
		}
		else {
			period.payslips.push(payslip);
			periods.set(pensionPeriodKey(period), period);
		}
	}

	return [ ...periods.values() ];
};

/**
 * The window one contribution period's credit may be dated in: from the period's first day to the end of the month after its
 * last one. **A period of one month is the payslip window of check 4, to the day.**
 * @param period The period.
 * @returns The window.
 */
const pensionPeriodWindow = (period: PensionPeriod): { fromDate: IsoDate; toDate: IsoDate } => {
	return {
		fromDate: firstDayOfMonth(period.year, period.startMonth),
		toDate: lastDayOfNextMonth(period.year, period.endMonth)
	};
};

/**
 * Pairs each non-zero pension figure of each contribution period with the credit into the fund that carried it.
 *
 * **A period is `pensionContributionMonths` months of one contract's payslips**, anchored to the start of the year, and the
 * figure a credit is compared against is that heading **summed over the period** ([§11.6]). At the default of one month that is
 * a single payslip's figure and the pairing is the monthly one it has always been; at three it is a quarterly credit against
 * January, February and March added together.
 *
 * **A sum of 0 is not a claim.** It expects no credit, takes no part in the walk and cannot be reported as unmatched: a heading
 * a period has nothing under is not a credit that failed to arrive.
 *
 * **The three figures are walked employee, then employer, then severance**, within a period walked in the order of the earliest
 * payslip it holds. Two of them being equal costs nothing: both pair, and the only thing that can be wrong is which of two
 * identical credits the *Matched* column names.
 * @param document The ledger.
 * @param months How many months of payslips one credit covers, which is a preference.
 * @returns The pairs, and what is left on either side.
 */
export const matchPensionContributions = (document: LedgerDocument, months: number): PensionMatching => {
	const payslips = sortPayslipsForMatching(document.payslips, document.contracts);
	const transactions = transactionsInRole(document, 'pension-contribution');
	const claims: PensionClaim[] = [];

	for(const period of groupPayslipsIntoPeriods(payslips, months)) {
		for(const figure of PENSION_FIGURES) {
			const amount = pensionPeriodAmount(period, figure);

			if(amount !== 0) {
				claims.push({ period, figure, amount });
			}
		}
	}

	const { matches, unmatchedClaims, unmatchedCandidateIds } = runOneToOneMatching<PensionClaim>({
		claims,
		candidates: transactions.map(toCandidate),
		keyOf: (claim) => {
			return pensionFigureKey(claim.period, claim.figure);
		},
		amountOf: (claim) => {
			return claim.amount;
		},
		windowOf: (claim) => {
			return pensionPeriodWindow(claim.period);
		}
	});

	const figureByTransaction = new Map<LedgerId, PensionClaim>();
	const claimsByKey = new Map(claims.map((claim) => {
		return [ pensionFigureKey(claim.period, claim.figure), claim ];
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
		transfers: matchInternalTransfers(document, {
			forwardDays: preferences.transferMatchWindowDays,
			backwardDays: preferences.transferMatchBackwardDays
		}),
		purchases: matchTradesToTransactions(document, 'purchase', preferences.tradeMatchWindowDays),
		sales: matchTradesToTransactions(document, 'sale', preferences.tradeMatchWindowDays),
		salaries: matchPayslipsToSalaries(document),
		pension: matchPensionContributions(document, preferences.pensionContributionMonths)
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
 * the counterpart account for a paired internal transfer, the security for a trade-matched securities transaction, the payslip
 * — its month and its label — for a salary payment, and the contribution period — its months — for a pension credit.
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
		names.set(transactionId, formatPensionPeriod(claim.period, translator));
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
