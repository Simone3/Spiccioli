import 'src/components/investments/InvestmentsScreen.css';
import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { AppButton, AppLinkButton } from 'src/components/common/AppButton';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { EmptyState } from 'src/components/common/EmptyState';
import { TabBar } from 'src/components/common/TabBar';
import { HoldingDetailPanel } from 'src/components/investments/HoldingDetailPanel';
import { HoldingsTable } from 'src/components/investments/HoldingsTable';
import type { PriceFormValues } from 'src/components/investments/PriceForm';
import { PriceHistoryPanel } from 'src/components/investments/PriceHistoryPanel';
import { SecuritiesTable } from 'src/components/investments/SecuritiesTable';
import { SecurityForm } from 'src/components/investments/SecurityForm';
import { toSecurity, type SecurityFormValues } from 'src/components/investments/SecurityFields';
import { TradeFiltersBar } from 'src/components/investments/TradeFilters';
import { TradeForm, type TradeFormValues } from 'src/components/investments/TradeForm';
import { TradesTable } from 'src/components/investments/TradesTable';
import { UpdatePricesDialog } from 'src/components/investments/UpdatePricesDialog';
import { APP_ROUTES } from 'src/components/shell/AppRoutes';
import { useInvestmentsHandoff } from 'src/components/shell/ScreenHandoff';
import { ScreenLayout } from 'src/components/shell/ScreenLayout';
import { useChecks } from 'src/contexts/ChecksContext';
import { useLedger } from 'src/contexts/LedgerContext';
import { useFormatter, usePreferences } from 'src/contexts/PreferencesContext';
import { useRemembered } from 'src/contexts/ScreenMemoryContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { DateUtils } from 'src/framework/utils/DateUtils';
import { indexInstitutions, isCashAccountType } from 'src/logic/accounts/Accounts';
import { matchedTradeDates } from 'src/logic/checks/Matching';
import { holdingAnnualisedReturn, portfolioAnnualisedReturn, type PortfolioReturn } from 'src/logic/investments/AnnualisedReturn';
import {
	deriveHoldings,
	positionKey,
	summariseSecurityPositions,
	totalHoldings,
	walkPositions
} from 'src/logic/investments/Holdings';
import {
	clearPriceHistory,
	countSecurityUsage,
	indexLatestPrices,
	indexSecurities,
	isPriceStale,
	priceHistoryOf,
	sortSecurities,
	writePrice,
	writePrices,
	type PriceClearance,
	type SecurityUsage
} from 'src/logic/investments/Securities';
import {
	countTradedSecurities,
	filterTrades,
	NO_TRADE_FILTERS,
	sortTradesNewestFirst,
	sumRealisedGains,
	sumTradeAmounts,
	tradesOfKind,
	tradeTotal,
	type TradeFilters
} from 'src/logic/investments/Trades';
import { createLedgerId, nextInsertionSeq } from 'src/logic/ledger/LedgerDocument';
import { MONEY_SCALES, narrowFromWorkingScale } from 'src/logic/money/Money';
import type { Account, IsoDate, LedgerId, Price, Security, TenThousandths, Trade, TradeKind } from 'src/types/LedgerTypes';

/**
 * Investments: four tabs, of which Holdings is entirely derived from the middle two and Securities is what all three point at.
 *
 * **Nothing on this screen is stored except what is typed.** Every quantity, average, value, gain and rate is walked from the
 * trades each time it is shown, so correcting a trade recorded eight years ago moves every figure that depends on it at once —
 * which is why a holding is never edited and a position is never repaired by hand.
 *
 * **A security is created from two tabs and is the same record either way.** The purchase form expands to create one while the
 * first trade that needs it is recorded; the Securities tab creates one on its own and is where every correction afterwards is
 * made, the price history included.
 *
 * **Every price is handled on the Securities tab and nowhere else**: the history, the form that writes one and *Update prices*
 * all sit there, because a price belongs to a security. Holdings states the price it derives from and links to that tab.
 */

type InvestmentsTab = 'holdings' | 'purchases' | 'sales' | 'securities';

// The record a form is open on. An undefined record is one being created; an undefined draft is a form that is not open.
interface SecurityDraft {
	security: Security | undefined;
}

// The trade a form is open on, and which of the two tabs it belongs to. An undefined trade is one being recorded.
interface TradeDraft {
	kind: TradeKind;
	trade: Trade | undefined;
}

/**
 * The Investments screen.
 * @returns The screen.
 */
export const InvestmentsScreen = (): ReactElement => {
	const translator = useTranslator();
	const { t } = translator;
	const formatter = useFormatter();
	const { preferences } = usePreferences();
	const { document, updateDocument } = useLedger();

	// The five pairings, derived by the checks run, of which this screen reads the two that name a trade's bank transaction
	const { matching: pairings } = useChecks();

	// The tab, the two filter sets and the two selections are what the screen is found showing when it is come back to ([§12.2])
	const [ tab, setTab ] = useRemembered<InvestmentsTab>('investments', 'tab', 'holdings');
	const [ purchaseFilters, setPurchaseFilters ] = useRemembered('investments', 'purchaseFilters', NO_TRADE_FILTERS);
	const [ saleFilters, setSaleFilters ] = useRemembered('investments', 'saleFilters', NO_TRADE_FILTERS);
	const [ selectedHoldingKey, setSelectedHoldingKey ] = useRemembered<string | undefined>('investments', 'holding', undefined);
	const [ selectedSecurityId, setSelectedSecurityId ] = useRemembered<LedgerId | undefined>('investments', 'security', undefined);
	const [ securityDraft, setSecurityDraft ] = useState<SecurityDraft | undefined>(undefined);
	const [ tradeDraft, setTradeDraft ] = useState<TradeDraft | undefined>(undefined);
	const [ securityToDelete, setSecurityToDelete ] = useState<Security | undefined>(undefined);
	const [ tradeToDelete, setTradeToDelete ] = useState<Trade | undefined>(undefined);
	const [ refusal, setRefusal ] = useState<string | undefined>(undefined);
	const [ notice, setNotice ] = useState<string | undefined>(undefined);
	const [ isUpdatingPrices, setIsUpdatingPrices ] = useState(false);

	const today = DateUtils.toStandardYearMonthDay(DateUtils.startOfToday());

	// A check entry arrives with the tab its record lives on and the filters that select it, and changes nothing else about
	// the screen: the same tables, the same orderings, every control free to be changed or cleared. What the screen was left
	// showing was forgotten before it arrived, so what is set below is the whole of what is set.
	const handoff = useInvestmentsHandoff();

	useEffect(() => {
		if(!handoff) {
			return;
		}

		setTab(handoff.tab);

		if(handoff.tab === 'securities') {
			setSelectedSecurityId(handoff.securityId);

			return;
		}

		const handedFilters: TradeFilters = {
			securityId: handoff.securityId,
			accountId: handoff.accountId,
			fromDate: handoff.fromDate,
			toDate: handoff.toDate
		};

		if(handoff.tab === 'purchases') {
			setPurchaseFilters(handedFilters);
		}
		else {
			setSaleFilters(handedFilters);
		}
	}, [ handoff, setPurchaseFilters, setSaleFilters, setSelectedSecurityId, setTab ]);

	const trades = useMemo(() => {
		return document?.trades ?? [];
	}, [ document ]);

	const prices = useMemo(() => {
		return document?.prices ?? [];
	}, [ document ]);

	const walk = useMemo(() => {
		return walkPositions(trades);
	}, [ trades ]);

	const holdings = useMemo(() => {
		return document ? deriveHoldings({ document, walk, translator }) : [];
	}, [ document, translator, walk ]);

	// One rate per position, the column stating each and the panel repeating the one it is open on
	const holdingReturns = useMemo((): ReadonlyMap<string, TenThousandths | undefined> => {
		return new Map(holdings.map((holding) => {
			return [ positionKey(holding.securityId, holding.accountId), holdingAnnualisedReturn(holding, walk, today) ];
		}));
	}, [ holdings, today, walk ]);

	// The one total that is not a sum of the column above it: every trade in the file, and the positions it cannot cover
	const portfolioReturn = useMemo((): PortfolioReturn => {
		return document ? portfolioAnnualisedReturn(document, walk, today) : { rate: undefined, omitted: 0 };
	}, [ document, today, walk ]);

	const securities = useMemo(() => {
		return indexSecurities(document?.securities ?? []);
	}, [ document ]);

	const orderedSecurities = useMemo(() => {
		return sortSecurities(document?.securities ?? []);
	}, [ document ]);

	const securityUsage = useMemo((): ReadonlyMap<LedgerId, SecurityUsage> => {
		return document ? countSecurityUsage(document) : new Map<LedgerId, SecurityUsage>();
	}, [ document ]);

	const securityPositions = useMemo(() => {
		return summariseSecurityPositions(walk);
	}, [ walk ]);

	// The newest price of each security, which is the day the *Last priced* column states and ages
	const latestPrices = useMemo(() => {
		return indexLatestPrices(prices);
	}, [ prices ]);

	const accounts = useMemo((): ReadonlyMap<LedgerId, Account> => {
		return new Map((document?.accounts ?? []).map((account) => {
			return [ account.id, account ];
		}));
	}, [ document ]);

	const institutions = useMemo(() => {
		return indexInstitutions(document?.institutions ?? []);
	}, [ document ]);

	// Newest first, the way the Transactions list is shown; everything that walks the trades reads them ascending instead
	const orderedTrades = useMemo(() => {
		return sortTradesNewestFirst(trades);
	}, [ trades ]);

	// What the *Matched* column shows, which is derived on the same run that reports the trades nothing paired with
	const matchedDates = useMemo((): ReadonlyMap<LedgerId, IsoDate> => {
		return document && pairings ? matchedTradeDates(document, pairings) : new Map();
	}, [ document, pairings ]);

	const purchases = tradesOfKind(orderedTrades, 'purchase');
	const sales = tradesOfKind(orderedTrades, 'sale');
	const selectedHolding = holdings.find((holding) => {
		return positionKey(holding.securityId, holding.accountId) === selectedHoldingKey;
	});
	const selectedSecurity = selectedSecurityId === undefined ? undefined : securities.get(selectedSecurityId);

	// Every write from this screen is a whole-document replacement, the file being read whole and written whole
	//
	// One save covers both a record being written and one being corrected, a correction that moves the date being the record
	// leaving the day it was on and replacing whatever occupied the day it lands on. Either way it is `manual` afterwards.
	const savePriceRecord = (securityId: LedgerId, original: Price | undefined, values: PriceFormValues): void => {
		updateDocument((current) => {
			const kept = original === undefined ?
				current.prices :
				current.prices.filter((candidate) => {
					return candidate.securityId !== original.securityId || candidate.date !== original.date;
				});

			return {
				...current,
				prices: writePrice(kept, { securityId, date: values.date, value: values.value, source: 'manual' })
			};
		});
	};

	const deletePriceRecord = (price: Price): void => {
		updateDocument((current) => {
			return {
				...current,
				prices: current.prices.filter((candidate) => {
					return candidate.securityId !== price.securityId || candidate.date !== price.date;
				})
			};
		});
	};

	// The bulk of the same delete: one security's whole history, or only the records a pass wrote. It is what puts right a pass
	// asked under a ticker or an exchange that names the wrong listing, which writes thousands of records in one press.
	const clearPriceRecords = (securityId: LedgerId, scope: PriceClearance): void => {
		updateDocument((current) => {
			return { ...current, prices: clearPriceHistory(current.prices, securityId, scope) };
		});
	};

	/**
	 * Writes what the modal's review was confirmed with, which is the only thing a pass ever writes.
	 *
	 * **Nothing reaches the file before this**: the pass gathers, the review is ticked, and the records arrive here already
	 * narrowed to the days that are new or that land on a different value.
	 * @param records What confirming writes.
	 */
	const writeFetchedPrices = (records: readonly Price[]): void => {
		const dates = records.map((record) => {
			return record.date;
		}).sort();

		// Laid over the history in one pass rather than one record at a time: a confirmed history is thousands of them, and
		// writing each through the whole history would re-read the file once per day of it
		updateDocument((current) => {
			return { ...current, prices: writePrices(current.prices, records) };
		});

		void window.spiccioliPrices.reportPricesWritten({
			writtenCount: records.length,
			firstDate: dates[0] ?? null,
			lastDate: dates[dates.length - 1] ?? null
		});
		setNotice(t('updatePrices.wrote', { count: records.length }));
		setIsUpdatingPrices(false);
	};

	// Closing without confirming writes nothing at all — no record, no half-finished pass. The log still hears that the pass ended.
	const closePriceModal = (): void => {
		void window.spiccioliPrices.reportPricesWritten({ writtenCount: 0, firstDate: null, lastDate: null });
		setIsUpdatingPrices(false);
	};

	const saveSecurity = (values: SecurityFormValues): void => {
		const existing = securityDraft?.security;

		updateDocument((current) => {
			return {
				...current,
				securities: existing ?
					current.securities.map((security) => {
						return security.id === existing.id ? toSecurity(values, existing.id) : security;
					}) :
					[ ...current.securities, toSecurity(values, createLedgerId()) ]
			};
		});
		setSecurityDraft(undefined);
	};

	// A security is blocked by its trades, and by nothing else: its price history goes with it
	const requestSecurityDeletion = (security: Security): void => {
		const tradeCount = securityUsage.get(security.id)?.trades ?? 0;

		if(tradeCount > 0) {
			setRefusal(t('securities.deleteBlockedByTrades', { ticker: security.ticker, count: tradeCount }));

			return;
		}

		setRefusal(undefined);
		setSecurityToDelete(security);
	};

	const deleteSecurity = (security: Security): void => {
		updateDocument((current) => {
			return {
				...current,
				securities: current.securities.filter((candidate) => {
					return candidate.id !== security.id;
				}),
				prices: current.prices.filter((price) => {
					return price.securityId !== security.id;
				})
			};
		});

		if(selectedSecurityId === security.id) {
			setSelectedSecurityId(undefined);
		}

		setSecurityToDelete(undefined);
	};

	const saveTrade = (kind: TradeKind, existing: Trade | undefined, values: TradeFormValues): void => {
		if(existing) {
			updateDocument((current) => {
				return {
					...current,
					trades: current.trades.map((candidate) => {
						return candidate.id === existing.id ?
							{
								...candidate,
								securityId: values.securityId ?? candidate.securityId,
								accountId: values.accountId,
								date: values.date,
								quantity: values.quantity,
								unitPrice: values.unitPrice,
								fees: values.fees,
								taxes: values.taxes,
								notes: values.notes
							} :
							candidate;
					})
				};
			});
			setTradeDraft(undefined);

			return;
		}

		const securityId = values.securityId ?? createLedgerId();

		updateDocument((current) => {
			const created: Trade = {
				id: createLedgerId(),
				kind,
				securityId,
				accountId: values.accountId,
				date: values.date,
				quantity: values.quantity,
				unitPrice: values.unitPrice,
				fees: values.fees,
				taxes: values.taxes,
				notes: values.notes,
				insertionSeq: nextInsertionSeq(current.trades)
			};

			return {
				...current,

				// The security and the trade are written in one step, so the file never holds a trade pointing at nothing
				securities: values.newSecurity ? [ ...current.securities, toSecurity(values.newSecurity, securityId) ] : current.securities,
				trades: [ ...current.trades, created ]
			};
		});
		setTradeDraft(undefined);
	};

	const deleteTrade = (trade: Trade): void => {
		updateDocument((current) => {
			return {
				...current,
				trades: current.trades.filter((candidate) => {
					return candidate.id !== trade.id;
				})
			};
		});
		setTradeToDelete(undefined);
	};

	const holdingsSummary = (): string => {
		const brokerageAccounts = (document?.accounts ?? []).filter((account) => {
			return !isCashAccountType(account.type);
		}).length;
		const stale = holdings.filter((holding) => {
			return holding.priceDate !== undefined && isPriceStale(holding.priceDate, preferences.priceStalenessDays);
		}).length;

		const figures = {
			positions: t('holdings.positionCount', { count: holdings.length }),
			accounts: t('holdings.accountCount', { count: brokerageAccounts })
		};

		return stale === 0 ?
			t('holdings.summary', figures) :
			t('holdings.summaryStale', { ...figures, stale: t('holdings.staleCount', { count: stale }) });
	};

	// Everything on this tab is derived, and the exclusions of the portfolio-wide return are a sentence rather than a figure
	const holdingsFooter = (omitted: number): ReactNode => {
		return (
			<>
				<div>{t('holdings.footerDerived')}</div>
				{omitted > 0 && <div>{t('holdings.footerReturnOmitted', { count: omitted })}</div>}
			</>
		);
	};

	const tradesFooter = (kind: TradeKind, matching: readonly Trade[]): ReactNode => {
		const fees = formatter.amount(sumTradeAmounts(matching, (trade) => {
			return trade.fees;
		}));
		const total = formatter.amount(sumTradeAmounts(matching, tradeTotal));
		const securityText = t('trades.securityCount', { count: countTradedSecurities(matching) });

		if(kind === 'purchase') {
			return t('trades.footerPurchases', {
				purchases: t('trades.purchaseCount', { count: matching.length }),
				securities: securityText,
				fees,
				total
			});
		}

		const realised = sumRealisedGains(matching, walk.realisedGains);
		const footer = t('trades.footerSales', {
			sales: t('trades.saleCount', { count: matching.length }),
			securities: securityText,
			fees,
			taxes: formatter.amount(sumTradeAmounts(matching, (trade) => {
				return trade.taxes;
			})),
			total,
			gain: formatter.amount(narrowFromWorkingScale(realised.total, MONEY_SCALES.amount), true)
		});

		return realised.omitted === 0 ? footer : t('trades.footerSalesOmitted', { footer, count: realised.omitted });
	};

	const tradesSummary = (kind: TradeKind, all: readonly Trade[], matching: readonly Trade[]): string | undefined => {
		if(all.length === 0) {
			return undefined;
		}

		const counted = kind === 'purchase' ?
			t('trades.purchaseCount', { count: all.length }) :
			t('trades.saleCount', { count: all.length });

		if(matching.length !== all.length) {
			return t('trades.summaryFiltered', { shown: formatter.integer(matching.length), trades: counted });
		}

		return counted;
	};

	const renderTradesTab = (kind: TradeKind): ReactElement => {
		const all = kind === 'purchase' ? purchases : sales;
		const filters = kind === 'purchase' ? purchaseFilters : saleFilters;
		const setFilters = kind === 'purchase' ? setPurchaseFilters : setSaleFilters;
		const matching = filterTrades(all, filters);
		const addButton = (
			<AppButton
				variant='primary'
				onClick={() => {
					setTradeDraft({ kind, trade: undefined });
				}}>
				{kind === 'purchase' ? t('trades.addPurchase') : t('trades.addSale')}
			</AppButton>
		);

		if(all.length === 0) {
			return (
				<EmptyState message={kind === 'purchase' ? t('emptyState.purchases') : t('emptyState.sales')}>
					{addButton}
				</EmptyState>
			);
		}

		return (
			<>
				<TradeFiltersBar
					filters={filters}
					onChange={setFilters}
					onClear={() => {
						setFilters(NO_TRADE_FILTERS);
					}}/>

				{matching.length === 0 ?
					<EmptyState message={t('emptyState.tradesFiltered')}>
						<AppButton
							onClick={() => {
								setFilters(NO_TRADE_FILTERS);
							}}>
							{t('filters.clear')}
						</AppButton>
					</EmptyState> :
					<TradesTable
						kind={kind}
						trades={matching}
						securities={securities}
						accounts={accounts}
						institutions={institutions}
						realisedGains={walk.realisedGains}
						matchedDates={matchedDates}
						footer={tradesFooter(kind, matching)}
						onEdit={(trade) => {
							setTradeDraft({ kind, trade });
						}}
						onDelete={setTradeToDelete}/>}
			</>
		);
	};

	const renderHoldingsTab = (): ReactElement => {
		if(holdings.length === 0) {
			return (
				<EmptyState message={t('emptyState.holdings')}>
					<AppButton
						variant='primary'
						onClick={() => {
							setTab('purchases');
							setTradeDraft({ kind: 'purchase', trade: undefined });
						}}>
						{t('trades.addPurchase')}
					</AppButton>
				</EmptyState>
			);
		}

		return (
			<div className='investments-screen-columns'>
				<HoldingsTable
					holdings={holdings}
					securities={securities}
					accounts={accounts}
					institutions={institutions}
					returns={holdingReturns}
					totals={totalHoldings(holdings)}
					portfolioReturn={portfolioReturn.rate}
					selected={selectedHolding}
					footer={holdingsFooter(portfolioReturn.omitted)}
					onSelect={(holding) => {
						setSelectedHoldingKey(positionKey(holding.securityId, holding.accountId));
					}}/>

				{selectedHolding && (
					<HoldingDetailPanel
						holding={selectedHolding}
						security={securities.get(selectedHolding.securityId)}
						account={accounts.get(selectedHolding.accountId)}
						institutions={institutions}
						annualisedReturn={holdingReturns.get(positionKey(selectedHolding.securityId, selectedHolding.accountId))}
						onClose={() => {
							setSelectedHoldingKey(undefined);
						}}/>
				)}
			</div>
		);
	};

	const renderSecuritiesTab = (): ReactElement => {
		const addButton = (
			<AppButton
				variant='primary'
				onClick={() => {
					setSecurityDraft({ security: undefined });
				}}>
				{t('securities.add')}
			</AppButton>
		);

		if(orderedSecurities.length === 0) {
			return <EmptyState message={t('emptyState.securities')}>{addButton}</EmptyState>;
		}

		const noLongerHeld = orderedSecurities.filter((security) => {
			const position = securityPositions.get(security.id);

			return !position || position.oversold || position.quantity <= 0;
		}).length;

		return (
			<div className='investments-screen-columns'>
				<SecuritiesTable
					securities={orderedSecurities}
					usage={securityUsage}
					positions={securityPositions}
					latestPrices={latestPrices}
					selectedId={selectedSecurityId}
					footer={t('securities.footer', {
						securities: t('securities.count', { count: orderedSecurities.length }),
						sold: formatter.integer(noLongerHeld)
					})}
					onSelect={(security) => {
						setSelectedSecurityId(security.id);
					}}
					onEdit={(security) => {
						setRefusal(undefined);
						setSecurityDraft({ security });
					}}
					onDelete={requestSecurityDeletion}/>

				{selectedSecurity && (
					<PriceHistoryPanel
						key={selectedSecurity.id}
						security={selectedSecurity}
						prices={priceHistoryOf(prices, selectedSecurity.id)}
						onSave={(original, values) => {
							savePriceRecord(selectedSecurity.id, original, values);
						}}
						onDelete={deletePriceRecord}
						onClear={(scope) => {
							clearPriceRecords(selectedSecurity.id, scope);
						}}
						onClose={() => {
							setSelectedSecurityId(undefined);
						}}/>
				)}
			</div>
		);
	};

	const subtitle = (): string | undefined => {
		if(tab === 'holdings') {
			return holdings.length === 0 ? undefined : holdingsSummary();
		}

		if(tab === 'securities') {
			if(orderedSecurities.length === 0) {
				return undefined;
			}

			const held = orderedSecurities.filter((security) => {
				const position = securityPositions.get(security.id);

				return position !== undefined && !position.oversold && position.quantity > 0;
			}).length;

			return t('securities.summary', {
				securities: t('securities.count', { count: orderedSecurities.length }),
				held: formatter.integer(held),
				sold: formatter.integer(orderedSecurities.length - held)
			});
		}

		const all = tab === 'purchases' ? purchases : sales;
		const filters = tab === 'purchases' ? purchaseFilters : saleFilters;

		return tradesSummary(tab === 'purchases' ? 'purchase' : 'sale', all, filterTrades(all, filters));
	};

	const actions = (): ReactNode => {
		// The button sits on the Securities tab, beside the list of what it offers to ask about: a price belongs to a security, and
		// every other way one is written is on this tab too. It opens the modal and does nothing else — nothing is sent by the
		// press itself, and what leaves the machine is stated on the page that sends it.
		if(tab === 'securities' && orderedSecurities.length > 0) {
			return (
				<div className='investments-screen-update-prices-buttons'>
					<AppButton
						onClick={() => {
							setNotice(undefined);
							setIsUpdatingPrices(true);
						}}>
						{t('updatePrices.button')}
					</AppButton>
					<AppButton
						variant='primary'
						onClick={() => {
							setSecurityDraft({ security: undefined });
						}}>
						{t('securities.add')}
					</AppButton>
				</div>
			);
		}

		if((tab === 'purchases' && purchases.length > 0) || (tab === 'sales' && sales.length > 0)) {
			const kind: TradeKind = tab === 'purchases' ? 'purchase' : 'sale';

			return (
				<AppButton
					variant='primary'
					onClick={() => {
						setTradeDraft({ kind, trade: undefined });
					}}>
					{kind === 'purchase' ? t('trades.addPurchase') : t('trades.addSale')}
				</AppButton>
			);
		}

		return undefined;
	};

	// Nothing has been recorded at all: the screen says what starts it rather than showing four empty tabs
	if(trades.length === 0 && orderedSecurities.length === 0) {
		return (
			<ScreenLayout title={t('screens.investments')}>
				<EmptyState message={t('emptyState.investments')}>
					<AppButton
						variant='primary'
						onClick={() => {
							setTab('purchases');
							setTradeDraft({ kind: 'purchase', trade: undefined });
						}}>
						{t('trades.addPurchase')}
					</AppButton>
					<AppLinkButton to={APP_ROUTES.accounts}>{t('emptyState.goToAccounts')}</AppLinkButton>
				</EmptyState>

				{tradeDraft && (
					<TradeForm
						kind={tradeDraft.kind}
						trade={tradeDraft.trade}
						onCancel={() => {
							setTradeDraft(undefined);
						}}
						onSave={(values) => {
							saveTrade(tradeDraft.kind, tradeDraft.trade, values);
						}}/>
				)}
			</ScreenLayout>
		);
	}

	return (
		<ScreenLayout title={t('screens.investments')} subtitle={subtitle()} actions={actions()}>
			<TabBar
				label={t('screens.investments')}
				active={tab}
				tabs={[
					{ key: 'holdings', label: t('investmentTabs.holdings') },
					{ key: 'purchases', label: t('investmentTabs.purchases', { count: purchases.length }) },
					{ key: 'sales', label: t('investmentTabs.sales', { count: sales.length }) },
					{ key: 'securities', label: t('investmentTabs.securities', { count: orderedSecurities.length }) }
				]}
				onSelect={(key) => {
					setRefusal(undefined);
					setNotice(undefined);
					setTab(key as InvestmentsTab);
				}}/>

			{refusal && (
				<div className='investments-screen-refusal' role='alert'>
					<p>{refusal}</p>
					<button
						type='button'
						className='investments-screen-refusal-dismiss'
						onClick={() => {
							setRefusal(undefined);
						}}>
						{t('notice.dismiss')}
					</button>
				</div>
			)}

			{notice && (
				<p className='investments-screen-notice' role='status'>{notice}</p>
			)}

			{tab === 'holdings' && renderHoldingsTab()}
			{tab === 'purchases' && renderTradesTab('purchase')}
			{tab === 'sales' && renderTradesTab('sale')}
			{tab === 'securities' && renderSecuritiesTab()}

			{isUpdatingPrices && document && (
				<UpdatePricesDialog
					securities={document.securities}
					prices={prices}
					trades={trades}
					positions={securityPositions}
					today={today}
					onWrite={writeFetchedPrices}
					onPassFailed={() => {
						setRefusal(t('updatePrices.passFailed'));
						setIsUpdatingPrices(false);
					}}
					onClose={closePriceModal}/>
			)}

			{securityDraft && (
				<SecurityForm
					security={securityDraft.security}
					onSave={saveSecurity}
					onCancel={() => {
						setSecurityDraft(undefined);
					}}/>
			)}

			{tradeDraft && (
				<TradeForm
					kind={tradeDraft.kind}
					trade={tradeDraft.trade}
					onCancel={() => {
						setTradeDraft(undefined);
					}}
					onSave={(values) => {
						saveTrade(tradeDraft.kind, tradeDraft.trade, values);
					}}/>
			)}

			{securityToDelete && (
				<ConfirmDialog
					danger
					title={t('securities.deleteTitle')}
					message={(securityUsage.get(securityToDelete.id)?.prices ?? 0) === 0 ?
						t('securities.deleteMessageNoPrices', { ticker: securityToDelete.ticker }) :
						t('securities.deleteMessage', {
							ticker: securityToDelete.ticker,
							count: securityUsage.get(securityToDelete.id)?.prices ?? 0
						})}
					confirmLabel={t('securities.deleteConfirm')}
					onConfirm={() => {
						deleteSecurity(securityToDelete);
					}}
					onCancel={() => {
						setSecurityToDelete(undefined);
					}}/>
			)}

			{tradeToDelete && (
				<ConfirmDialog
					danger
					title={t('trades.deleteTitle')}
					message={t('trades.deleteMessage', {
						security: securities.get(tradeToDelete.securityId)?.ticker ?? '',
						date: formatter.storedDate(tradeToDelete.date),
						total: formatter.amount(tradeTotal(tradeToDelete))
					})}
					confirmLabel={t('trades.deleteConfirm')}
					onConfirm={() => {
						deleteTrade(tradeToDelete);
					}}
					onCancel={() => {
						setTradeToDelete(undefined);
					}}/>
			)}
		</ScreenLayout>
	);
};
