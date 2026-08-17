import 'src/components/investments/InvestmentsScreen.css';
import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { AppButton, AppLinkButton } from 'src/components/common/AppButton';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { EmptyState } from 'src/components/common/EmptyState';
import { TabBar } from 'src/components/common/TabBar';
import { HoldingDetailPanel } from 'src/components/investments/HoldingDetailPanel';
import { HoldingsTable } from 'src/components/investments/HoldingsTable';
import { PriceHistoryPanel } from 'src/components/investments/PriceHistoryPanel';
import { SecuritiesTable } from 'src/components/investments/SecuritiesTable';
import { SecurityForm } from 'src/components/investments/SecurityForm';
import { toSecurity, type SecurityFormValues } from 'src/components/investments/SecurityFields';
import { TradeFiltersBar } from 'src/components/investments/TradeFilters';
import { TradeForm, type TradeFormValues } from 'src/components/investments/TradeForm';
import { TradesTable } from 'src/components/investments/TradesTable';
import { APP_ROUTES } from 'src/components/shell/AppRoutes';
import { ScreenLayout } from 'src/components/shell/ScreenLayout';
import { useLedger } from 'src/contexts/LedgerContext';
import { useFormatter, usePreferences } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { DateUtils } from 'src/framework/utils/DateUtils';
import { indexInstitutions, isCashAccountType } from 'src/logic/accounts/Accounts';
import { holdingAnnualisedReturn, portfolioAnnualisedReturn } from 'src/logic/investments/AnnualisedReturn';
import {
	deriveHoldings,
	positionKey,
	summariseSecurityPositions,
	totalHoldings,
	walkPositions
} from 'src/logic/investments/Holdings';
import {
	countSecurityUsage,
	indexSecurities,
	isPriceStale,
	priceHistoryOf,
	priceOnDay,
	sortSecurities,
	writePrice,
	type SecurityUsage
} from 'src/logic/investments/Securities';
import {
	countTradedSecurities,
	filterTrades,
	NO_TRADE_FILTERS,
	sortTrades,
	sumRealisedGains,
	sumTradeAmounts,
	tradesOfKind,
	tradeTotal,
	tradeYearRange,
	type TradeFilters
} from 'src/logic/investments/Trades';
import { createLedgerId, nextInsertionSeq } from 'src/logic/ledger/LedgerDocument';
import { MONEY_SCALES, narrowFromWorkingScale } from 'src/logic/money/Money';
import type { Account, IsoDate, LedgerId, Price, Security, Trade, TradeKind } from 'src/types/LedgerTypes';

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
 */

type InvestmentsTab = 'holdings' | 'purchases' | 'sales' | 'securities';

// The record a form is open on. An undefined record is one being created; an undefined draft is a form that is not open.
interface SecurityDraft {
	security: Security | undefined;
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

	const [ tab, setTab ] = useState<InvestmentsTab>('holdings');
	const [ purchaseFilters, setPurchaseFilters ] = useState<TradeFilters>(NO_TRADE_FILTERS);
	const [ saleFilters, setSaleFilters ] = useState<TradeFilters>(NO_TRADE_FILTERS);
	const [ selectedHoldingKey, setSelectedHoldingKey ] = useState<string | undefined>(undefined);
	const [ selectedSecurityId, setSelectedSecurityId ] = useState<LedgerId | undefined>(undefined);
	const [ securityDraft, setSecurityDraft ] = useState<SecurityDraft | undefined>(undefined);
	const [ tradeToAdd, setTradeToAdd ] = useState<TradeKind | undefined>(undefined);
	const [ securityToDelete, setSecurityToDelete ] = useState<Security | undefined>(undefined);
	const [ tradeToDelete, setTradeToDelete ] = useState<Trade | undefined>(undefined);
	const [ refusal, setRefusal ] = useState<string | undefined>(undefined);

	const today = DateUtils.toStandardYearMonthDay(DateUtils.startOfToday());

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

	const accounts = useMemo((): ReadonlyMap<LedgerId, Account> => {
		return new Map((document?.accounts ?? []).map((account) => {
			return [ account.id, account ];
		}));
	}, [ document ]);

	const institutions = useMemo(() => {
		return indexInstitutions(document?.institutions ?? []);
	}, [ document ]);

	const orderedTrades = useMemo(() => {
		return sortTrades(trades);
	}, [ trades ]);

	const purchases = tradesOfKind(orderedTrades, 'purchase');
	const sales = tradesOfKind(orderedTrades, 'sale');
	const selectedHolding = holdings.find((holding) => {
		return positionKey(holding.securityId, holding.accountId) === selectedHoldingKey;
	});
	const selectedSecurity = selectedSecurityId === undefined ? undefined : securities.get(selectedSecurityId);

	// Every write from this screen is a whole-document replacement, the file being read whole and written whole
	const writePriceRecord = (price: Price): void => {
		updateDocument((current) => {
			return { ...current, prices: writePrice(current.prices, price) };
		});
	};

	const movePriceRecord = (price: Price, date: IsoDate): void => {
		updateDocument((current) => {
			const withoutIt = current.prices.filter((candidate) => {
				return candidate.securityId !== price.securityId || candidate.date !== price.date;
			});

			return { ...current, prices: writePrice(withoutIt, { ...price, date, source: 'manual' }) };
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

	const addTrade = (kind: TradeKind, values: TradeFormValues): void => {
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
		setTradeToAdd(undefined);
	};

	const editTrade = (trade: Trade, changes: Partial<Trade>): void => {
		updateDocument((current) => {
			return {
				...current,
				trades: current.trades.map((candidate) => {
					return candidate.id === trade.id ? { ...candidate, ...changes } : candidate;
				})
			};
		});
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
		const dated = holdings.map((holding) => {
			return holding.priceDate;
		}).filter((date): date is IsoDate => {
			return date !== undefined;
		});
		const latest = dated.length === 0 ?
			t('holdings.noPrices') :
			t('holdings.latestPrice', { date: formatter.storedDate(dated.reduce((newest, date) => {
				return date > newest ? date : newest;
			})) });
		const stale = holdings.filter((holding) => {
			return holding.priceDate !== undefined && isPriceStale(holding.priceDate, preferences.priceStalenessDays);
		}).length;

		const figures = {
			positions: t('holdings.positionCount', { count: holdings.length }),
			accounts: t('holdings.accountCount', { count: brokerageAccounts }),
			priced: latest
		};

		return stale === 0 ?
			t('holdings.summary', figures) :
			t('holdings.summaryStale', { ...figures, stale: t('holdings.staleCount', { count: stale }) });
	};

	const holdingsFooter = (): ReactNode => {
		const totals = totalHoldings(holdings);
		const gain = narrowFromWorkingScale(totals.gain, MONEY_SCALES.amount);
		const portfolio = document ? portfolioAnnualisedReturn(document, walk, today) : { rate: undefined, omitted: 0 };
		const rate = portfolio.rate === undefined ? t('table.undefined') : formatter.percentage(portfolio.rate);

		return (
			<>
				<div>
					{t('holdings.footer', {
						holdings: t('holdings.holdingCount', { count: holdings.length }),
						days: t('holdings.staleAfter', { count: preferences.priceStalenessDays }),
						value: formatter.amount(narrowFromWorkingScale(totals.value, MONEY_SCALES.amount)),
						gain: totals.gainPct === undefined ?
							formatter.amount(gain, true) :
							t('holdings.gainWithPercentage', {
								gain: formatter.amount(gain, true),
								percentage: formatter.percentage(totals.gainPct)
							})
					})}
				</div>
				<div className='investments-screen-note'>
					{portfolio.omitted === 0 ?
						t('holdings.footerReturn', { rate }) :
						t('holdings.footerReturnOmitted', { rate, count: portfolio.omitted })}
				</div>
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

		const range = tradeYearRange(all);

		return range ?
			t('trades.summary', { trades: counted, range: t('trades.range', { from: range.from, to: range.to }) }) :
			counted;
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
					setTradeToAdd(kind);
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
						footer={tradesFooter(kind, matching)}
						onEdit={editTrade}
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
							setTradeToAdd('purchase');
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
					selected={selectedHolding}
					today={today}
					footer={holdingsFooter()}
					priceOn={(securityId, date) => {
						return priceOnDay(prices, securityId, date)?.value;
					}}
					onSelect={(holding) => {
						setSelectedHoldingKey(positionKey(holding.securityId, holding.accountId));
					}}
					onWritePrice={(securityId, date, value) => {
						writePriceRecord({ securityId, date, value, source: 'manual' });
					}}/>

				{selectedHolding && (
					<HoldingDetailPanel
						holding={selectedHolding}
						security={securities.get(selectedHolding.securityId)}
						account={accounts.get(selectedHolding.accountId)}
						institutions={institutions}
						annualisedReturn={holdingAnnualisedReturn(selectedHolding, walk, today)}
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
						security={selectedSecurity}
						prices={priceHistoryOf(prices, selectedSecurity.id)}
						onWrite={writePriceRecord}
						onMove={movePriceRecord}
						onDelete={deletePriceRecord}
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
		if(tab === 'securities' && orderedSecurities.length > 0) {
			return (
				<AppButton
					variant='primary'
					onClick={() => {
						setSecurityDraft({ security: undefined });
					}}>
					{t('securities.add')}
				</AppButton>
			);
		}

		if((tab === 'purchases' && purchases.length > 0) || (tab === 'sales' && sales.length > 0)) {
			const kind: TradeKind = tab === 'purchases' ? 'purchase' : 'sale';

			return (
				<AppButton
					variant='primary'
					onClick={() => {
						setTradeToAdd(kind);
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
							setTradeToAdd('purchase');
						}}>
						{t('trades.addPurchase')}
					</AppButton>
					<AppLinkButton to={APP_ROUTES.accounts}>{t('emptyState.goToAccounts')}</AppLinkButton>
				</EmptyState>

				{tradeToAdd && (
					<TradeForm
						kind={tradeToAdd}
						onCancel={() => {
							setTradeToAdd(undefined);
						}}
						onSave={(values) => {
							addTrade(tradeToAdd, values);
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

			{tab === 'holdings' && renderHoldingsTab()}
			{tab === 'purchases' && renderTradesTab('purchase')}
			{tab === 'sales' && renderTradesTab('sale')}
			{tab === 'securities' && renderSecuritiesTab()}

			{securityDraft && (
				<SecurityForm
					security={securityDraft.security}
					onSave={saveSecurity}
					onCancel={() => {
						setSecurityDraft(undefined);
					}}/>
			)}

			{tradeToAdd && (
				<TradeForm
					kind={tradeToAdd}
					onCancel={() => {
						setTradeToAdd(undefined);
					}}
					onSave={(values) => {
						addTrade(tradeToAdd, values);
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
