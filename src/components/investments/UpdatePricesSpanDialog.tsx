import { useEffect, useId, useRef, type ReactElement } from 'react';
import { AppButton } from 'src/components/common/AppButton';
import { useTranslator } from 'src/i18n/TranslationContext';
import type { PricePassSpan } from 'src/logic/investments/PriceUpdate';

/**
 * The one question the *Update prices* button puts, asked before anything leaves the machine.
 *
 * **How far back, and nothing else.** There is still no security to tick, no provider to pick and no setting behind the button:
 * the answer is given once and covers the whole pass, and it is not remembered for the next one.
 *
 * **The statement of what leaves the machine is here too**, because this is now the last thing seen before a request is made.
 */

export interface UpdatePricesSpanDialogProps {

	// Runs the pass on the span chosen
	onChoose: (span: PricePassSpan) => void;

	onCancel: () => void;
}

/**
 * The choice.
 * @param props The dialog's props.
 * @param props.onChoose What running the pass on a span does.
 * @param props.onCancel What cancelling does, which is nothing at all.
 * @returns The dialog.
 */
export const UpdatePricesSpanDialog = ({ onChoose, onCancel }: UpdatePricesSpanDialogProps): ReactElement => {
	const { t } = useTranslator();
	const titleId = useId();
	const firstRef = useRef<HTMLDivElement>(null);

	// The keyboard opens on the shorter pass, which is the one an open file needs and the one that costs least
	useEffect(() => {
		firstRef.current?.querySelector('button')?.focus();
	}, []);

	return (
		<div
			className='update-prices-overlay'
			role='presentation'
			onKeyDown={(event) => {
				if(event.key === 'Escape') {
					onCancel();
				}
			}}>
			<div className='update-prices-panel update-prices-panel-narrow' role='dialog' aria-modal='true' aria-labelledby={titleId}>
				<div className='update-prices-heading'>
					<h2 className='update-prices-title' id={titleId}>{t('updatePrices.span.title')}</h2>
					<span className='investments-screen-detail-subtitle'>{t('updatePrices.span.subtitle')}</span>
				</div>

				<div className='update-prices-choices'>
					<div className='update-prices-choice' ref={firstRef}>
						<AppButton
							variant='primary'
							onClick={() => {
								onChoose('latest');
							}}>
							{t('updatePrices.span.latest')}
						</AppButton>
						<p>{t('updatePrices.span.latestNote')}</p>
					</div>

					<div className='update-prices-choice'>
						<AppButton
							onClick={() => {
								onChoose('history');
							}}>
							{t('updatePrices.span.history')}
						</AppButton>
						<p>{t('updatePrices.span.historyNote')}</p>
					</div>
				</div>

				<p className='investments-screen-note'>{t('updatePrices.whatLeaves', { provider: t('updatePrices.providerName') })}</p>

				<div className='update-prices-actions'>
					<AppButton variant='ghost' onClick={onCancel}>{t('dialog.cancel')}</AppButton>
				</div>
			</div>
		</div>
	);
};
