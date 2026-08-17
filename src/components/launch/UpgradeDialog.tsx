import 'src/components/launch/LaunchScreen.css';
import { type ReactElement } from 'react';
import { useLedger } from 'src/contexts/LedgerContext';
import { usePreferences } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { getFileName } from 'src/logic/format/FilePathDisplay';

/**
 * The second panel of the launch screen: the file was written by an older version and has to be converted.
 *
 * It names both schema versions, **states the backup in the sentence rather than in a footnote**, says that the rules will be
 * re-applied to every automatically categorised transaction as part of the upgrade, and says plainly what stops working
 * afterwards. Cancelling writes nothing at all and the launch screen returns.
 *
 * **A pre-upgrade copy that cannot be written stops the upgrade.** The reason the system gave is stated here and the panel
 * offers Retry and Cancel; nothing has been written to the file either way.
 * @returns The screen.
 */
export const UpgradeDialog = (): ReactElement => {
	const { t } = useTranslator();
	const { preferences } = usePreferences();
	const { upgradePrompt, confirmUpgrade, cancelUpgrade, isBusy } = useLedger();

	if(!upgradePrompt) {
		return <></>;
	}

	return (
		<div className='launch-screen'>
			<div className='launch-screen-panel'>
				<h1 className='launch-screen-title'>{t('upgrade.title')}</h1>
				<p className='launch-screen-subtitle'>{getFileName(upgradePrompt.filePath)}</p>

				<dl className='launch-screen-figures'>
					<div className='launch-screen-figure'>
						<dt>{t('upgrade.writtenBy')}</dt>
						<dd>{upgradePrompt.fromSchemaVersion}</dd>
					</div>
					<div className='launch-screen-figure'>
						<dt>{t('upgrade.thisVersionReads')}</dt>
						<dd>{upgradePrompt.toSchemaVersion}</dd>
					</div>
				</dl>

				<p className='launch-screen-hint'>
					{t('upgrade.explanation', {
						toSchemaVersion: upgradePrompt.toSchemaVersion,
						count: preferences.backupCount
					})}
				</p>
				<p className='launch-screen-hint'>{t('upgrade.rulesReapplied')}</p>
				<p className='launch-screen-hint'>{t('upgrade.irreversible', { fromSchemaVersion: upgradePrompt.fromSchemaVersion })}</p>

				{upgradePrompt.backupFailureMessage && (
					<div className='launch-screen-failure' role='alert'>
						<p className='launch-screen-failure-message'>
							{t('upgrade.backupFailed', { message: upgradePrompt.backupFailureMessage })}
						</p>
					</div>
				)}

				<div className='launch-screen-actions'>
					<button type='button' className='launch-screen-button' disabled={isBusy} onClick={cancelUpgrade}>
						{t('upgrade.cancel')}
					</button>
					<button
						type='button'
						className='launch-screen-button launch-screen-button-primary'
						disabled={isBusy}
						onClick={() => {
							void confirmUpgrade();
						}}>
						{upgradePrompt.backupFailureMessage ? t('upgrade.retry') : t('upgrade.confirm')}
					</button>
				</div>
			</div>
		</div>
	);
};
