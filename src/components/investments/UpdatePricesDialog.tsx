import { useEffect, useId, useMemo, useRef, useState, type ReactElement } from 'react';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { UpdatePricesChoice } from 'src/components/investments/UpdatePricesChoice';
import { UpdatePricesReview } from 'src/components/investments/UpdatePricesReview';
import { usePreferences } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import type { SecurityPosition } from 'src/logic/investments/Holdings';
import {
	planPricePass,
	reviewPricePass,
	selectSecurities,
	toFetchedPrices,
	toPriceListings,
	type PriceListingPlan,
	type PricePassSpan,
	type PriceSelectionKind,
	type PriceUpdateRow
} from 'src/logic/investments/PriceUpdate';
import type { IsoDate, LedgerId, Price, Security, Trade } from 'src/types/LedgerTypes';
import type { PriceFetchOutcome, PriceListingRequest } from 'src/types/PriceIpcTypes';

/**
 * *Update prices*, from the question to the write, in one modal of two pages.
 *
 * **The button opens this and does nothing else.** The network is reached from the first page and from nowhere else, and
 * **nothing is written until the second page is confirmed**: the pass gathers, the file is untouched, and cancelling at any
 * moment leaves every price the file had standing.
 *
 * **The two pages share one list of rows.** The first states what the file holds for each security and what the pass would ask
 * about it; the second is drawn the moment the pass starts and fills in row by row, so no row moves and nothing is redrawn when
 * the last answer lands.
 *
 * **Nothing here is remembered between two presses.** The span goes back to its default and the ticks back to the securities
 * holding a position, every time the modal is opened.
 */

// What the modal defaults to: the incremental answer, which on a current file asks for a day or two per security
const DEFAULT_SPAN: PricePassSpan = 'since-last';

interface PassState {

	// The listings the pass was given, in the order they are asked in. A retry keeps the original list, so the rows it is not
	// asking about again keep the answers they already have.
	asked: LedgerId[];

	outcomes: PriceFetchOutcome[];
	referenceDate: IsoDate | undefined;
	running: boolean;

	// How far the running request has got, which for a retry counts the retried listings and not the whole original pass
	done: number;
	total: number;
}

export interface UpdatePricesDialogProps {
	securities: readonly Security[];
	prices: readonly Price[];
	trades: readonly Trade[];

	// What each security still holds, which decides both the default tick and where a window ends
	positions: ReadonlyMap<LedgerId, SecurityPosition>;

	today: IsoDate;

	// Writes the ticked rows and closes the modal
	onWrite: (records: readonly Price[]) => void;

	// The bridge itself having failed, which is a bug rather than a provider that could not be reached
	onPassFailed: () => void;

	onClose: () => void;
}

// A retry answers for some of the securities the pass asked about; the rest keep the answers they already have
const mergeOutcomes = (kept: readonly PriceFetchOutcome[], arriving: readonly PriceFetchOutcome[]): PriceFetchOutcome[] => {
	const merged = new Map(kept.map((outcome) => {
		return [ outcome.securityId, outcome ];
	}));

	for(const outcome of arriving) {
		merged.set(outcome.securityId, outcome);
	}

	return [ ...merged.values() ];
};

/**
 * The modal.
 * @param props The modal's props.
 * @param props.securities Every security in the file.
 * @param props.prices Every price in the file.
 * @param props.trades Every trade in the file.
 * @param props.positions What each security still holds.
 * @param props.today The day the pass is being run on.
 * @param props.onWrite What confirming writes.
 * @param props.onPassFailed What a bridge failure does.
 * @param props.onClose What closing does, which writes nothing.
 * @returns The modal.
 */
export const UpdatePricesDialog = ({
	securities,
	prices,
	trades,
	positions,
	today,
	onWrite,
	onPassFailed,
	onClose
}: UpdatePricesDialogProps): ReactElement => {
	const { t } = useTranslator();
	const { preferences } = usePreferences();
	const titleId = useId();

	const [ span, setSpan ] = useState<PricePassSpan>(DEFAULT_SPAN);

	const plans = useMemo((): PriceListingPlan[] => {
		return planPricePass({ securities, span, prices, trades, positions, today });
	}, [ positions, prices, securities, span, today, trades ]);

	// The modal opens on the securities holding a position. It is worked out once: a plan rebuilt by a change of span moves no
	// tick, the securities being the same securities.
	const [ selected, setSelected ] = useState<ReadonlySet<LedgerId>>(() => {
		return selectSecurities(plans, 'held', preferences.priceStalenessDays);
	});

	const [ pass, setPass ] = useState<PassState | undefined>(undefined);
	const [ ticked, setTicked ] = useState<ReadonlySet<LedgerId>>(new Set());
	const [ expanded, setExpanded ] = useState<ReadonlySet<LedgerId>>(new Set());
	const [ isConfirmingStop, setIsConfirmingStop ] = useState(false);

	// Raised the moment the user abandons the pass. What is still in flight finishes and is dropped: a cancelled pass ends at
	// nothing, and a modal that has closed is not drawn into.
	const abandoned = useRef(false);

	useEffect(() => {
		return () => {
			abandoned.current = true;
		};
	}, []);

	const review = useMemo(() => {
		return reviewPricePass({
			securities,
			asked: pass?.asked ?? [],
			outcomes: pass?.outcomes ?? [],
			prices,
			referenceDate: pass?.referenceDate
		});
	}, [ pass, prices, securities ]);

	const askingTicker = review.entries.find((entry) => {
		return entry.state === 'asking';
	})?.security.ticker;

	const toggle = (current: ReadonlySet<LedgerId>, securityId: LedgerId): Set<LedgerId> => {
		const next = new Set(current);

		if(!next.delete(securityId)) {
			next.add(securityId);
		}

		return next;
	};

	/**
	 * Runs a pass, which is the one thing in the application that reaches the network.
	 *
	 * **A retry is an ordinary pass over fewer listings**: the rows it does not ask about again keep the answers they have, and
	 * the ones it does go back to being queued until they answer.
	 * @param listings What to ask about.
	 * @param previous The pass being retried, where this is a retry.
	 */
	const runPass = async(listings: PriceListingRequest[], previous?: PassState): Promise<void> => {
		const retried = new Set(listings.map((listing) => {
			return listing.securityId;
		}));
		const kept = (previous?.outcomes ?? []).filter((outcome) => {
			return !retried.has(outcome.securityId);
		});

		abandoned.current = false;
		setExpanded(new Set());
		setTicked(new Set());
		setPass({
			asked: previous?.asked ?? listings.map((listing) => {
				return listing.securityId;
			}),
			outcomes: kept,
			referenceDate: previous?.referenceDate,
			running: true,
			done: 0,
			total: listings.length
		});

		const stopListening = window.spiccioliPrices.onPassProgress((progress) => {
			if(abandoned.current) {
				return;
			}

			setPass((current) => {
				return current === undefined ?
					current :
					{ ...current, outcomes: mergeOutcomes(current.outcomes, [ progress.outcome ]), done: progress.done };
			});
		});

		try {
			const result = await window.spiccioliPrices.updatePrices(listings);

			if(abandoned.current) {
				return;
			}

			const outcomes = mergeOutcomes(kept, result.outcomes);

			setPass((current) => {
				return current === undefined ?
					current :
					{
						...current,
						outcomes,
						referenceDate: result.referenceDate ?? current.referenceDate,
						running: false,
						done: listings.length
					};
			});

			// Everything that can be written is ticked when the pass lands, so the common answer is one press
			const landed = reviewPricePass({ securities, asked: [], outcomes, prices });

			setTicked(new Set(landed.entries.flatMap((entry) => {
				return entry.state === 'quoted' && entry.row.writes.length > 0 ? [ entry.security.id ] : [];
			})));
		}
		catch {
			// The pass itself reports a provider that could not be reached as a row, so reaching here is the bridge having failed
			// rather than the network
			if(!abandoned.current) {
				onPassFailed();
			}
		}
		finally {
			stopListening();
		}
	};

	// Cancelling a running pass abandons it: what is in flight is finished and thrown away, and nothing behind it is asked for
	const stopAndClose = (): void => {
		abandoned.current = true;
		void window.spiccioliPrices.cancelPricePass();
		onClose();
	};

	const close = (): void => {
		if(pass?.running) {
			setIsConfirmingStop(true);

			return;
		}

		onClose();
	};

	const confirm = (): void => {
		const rows = review.entries.flatMap((entry): PriceUpdateRow[] => {
			return entry.state === 'quoted' && ticked.has(entry.security.id) ? [ entry.row ] : [];
		});

		onWrite(toFetchedPrices(rows));
	};

	return (
		<div
			className='update-prices-overlay'
			role='presentation'
			onKeyDown={(event) => {
				if(event.key === 'Escape' && !isConfirmingStop) {
					close();
				}
			}}>
			<div className='update-prices-panel' role='dialog' aria-modal='true' aria-labelledby={titleId}>
				<div className='update-prices-heading'>
					<h2 className='update-prices-title' id={titleId}>
						{pass === undefined ? t('updatePrices.title') : t(pass.running ? 'updatePrices.fetching' : 'updatePrices.fetched')}
					</h2>
					<div className='update-prices-steps'>
						<span className={pass === undefined ? 'update-prices-step-on' : undefined}>{t('updatePrices.steps.choose')}</span>
						<span className={pass === undefined ? undefined : 'update-prices-step-on'}>{t('updatePrices.steps.fetch')}</span>
					</div>
				</div>

				{pass === undefined ?
					<UpdatePricesChoice
						plans={plans}
						span={span}
						selected={selected}
						onSpanChange={setSpan}
						onToggle={(securityId) => {
							setSelected(toggle(selected, securityId));
						}}
						onSelect={(kind: PriceSelectionKind) => {
							setSelected(selectSecurities(plans, kind, preferences.priceStalenessDays));
						}}
						onCancel={onClose}
						onFetch={() => {
							void runPass(toPriceListings(plans, selected));
						}}/> :
					<UpdatePricesReview
						entries={review.entries}
						referenceDate={review.referenceDate}
						running={pass.running}
						done={pass.done}
						total={pass.total}
						askingTicker={askingTicker}
						retryableCount={review.retryableIds.length}
						ticked={ticked}
						expanded={expanded}
						onToggle={(securityId) => {
							setTicked(toggle(ticked, securityId));
						}}
						onTickAll={(all) => {
							setTicked(new Set(all ?
								review.entries.flatMap((entry) => {
									return entry.state === 'quoted' && entry.row.writes.length > 0 ? [ entry.security.id ] : [];
								}) :
								[]));
						}}
						onExpand={(securityId) => {
							setExpanded(toggle(expanded, securityId));
						}}
						onBack={() => {
							setPass(undefined);
						}}
						onRetry={() => {
							const retryable = new Set(review.retryableIds);

							void runPass(toPriceListings(plans, retryable), pass);
						}}
						onCancel={close}
						onConfirm={confirm}/>}
			</div>

			{isConfirmingStop && (
				<ConfirmDialog
					title={t('updatePrices.stopTitle')}
					message={t('updatePrices.stopMessage')}
					confirmLabel={t('updatePrices.stopConfirm')}
					cancelLabel={t('updatePrices.stopCancel')}
					onConfirm={stopAndClose}
					onCancel={() => {
						setIsConfirmingStop(false);
					}}/>
			)}
		</div>
	);
};
