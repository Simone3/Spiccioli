import 'src/components/session/WriteFailurePanel.css';
import { type ReactElement } from 'react';
import { AppButton } from 'src/components/common/AppButton';
import { useLedger } from 'src/contexts/LedgerContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { getDirectory, getFileName } from 'src/logic/format/FilePathDisplay';

/**
 * The one error that belongs to no screen: the file could not be written after five attempts.
 *
 * It blocks, and it is one of exactly two things in the application that do. It states **which file could not be written and
 * what the system said**, and offers *Retry* and nothing else — there is no *Continue anyway* and no *Save As…*. The way out is
 * to free the disk, reconnect the volume or unlock the file, with the whole session still in memory waiting for it.
 * @returns The screen.
 */
export const WriteFailurePanel = (): ReactElement => {
	const { t } = useTranslator();
	const { saveState, retrySave, isBusy } = useLedger();

	if(saveState.state !== 'failed') {
		return <></>;
	}

	return (
		<div className='write-failure-overlay' role='alertdialog' aria-modal='true' aria-labelledby='write-failure-title'>
			<div className='write-failure-panel'>
				<h2 className='write-failure-title' id='write-failure-title'>{t('writeFailure.title')}</h2>
				<p className='write-failure-subtitle'>{t('writeFailure.subtitle', { name: getFileName(saveState.filePath) })}</p>

				<dl className='write-failure-figures'>
					<div>
						<dt>{t('writeFailure.location')}</dt>
						<dd>{getDirectory(saveState.filePath)}</dd>
					</div>
					<div>
						<dt>{t('writeFailure.systemSaid')}</dt>
						<dd>{saveState.message}</dd>
					</div>
				</dl>

				<p className='write-failure-reassurance'>{t('writeFailure.reassurance')}</p>

				<div className='write-failure-actions'>
					<AppButton
						variant='primary'
						disabled={isBusy}
						onClick={() => {
							void retrySave();
						}}>
						{t('writeFailure.retry')}
					</AppButton>
				</div>
			</div>
		</div>
	);
};
