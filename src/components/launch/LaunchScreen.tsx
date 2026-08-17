import 'src/components/launch/LaunchScreen.css';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { UpgradeDialog } from 'src/components/launch/UpgradeDialog';
import { useLedger } from 'src/contexts/LedgerContext';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { getDirectory, getFileName } from 'src/logic/format/FilePathDisplay';
import { describeLedgerRefusal } from 'src/logic/ledger/LedgerRefusalMessage';
import type { RecentLedgerFile } from 'src/types/PreferencesTypes';

/**
 * The screen the application always opens with.
 *
 * It never reopens the last file on its own: the recent locations are offered and one of them is chosen, or a file is browsed
 * for, or a new one is created — and *New file…* writes the seeded file at the moment the location is chosen, before any other
 * screen is shown.
 *
 * This is the one screen whose errors can keep the user out of the rest of the application. A file that is missing, unreadable,
 * written by a newer schema version or carrying something unrecognised is stated here, **with the other files still openable**.
 * A file written by an older version is not an error at all and opens the upgrade panel instead.
 * @returns The screen.
 */
export const LaunchScreen = (): ReactElement => {
	const translator = useTranslator();
	const { t } = translator;
	const formatter = useFormatter();
	const { openWithDialog, openPath, createWithDialog, openFailure, dismissOpenFailure, upgradePrompt, isBusy } = useLedger();
	const [ recentFiles, setRecentFiles ] = useState<RecentLedgerFile[]>([]);

	useEffect(() => {
		let isMounted = true;

		void Promise.resolve().then(() => {
			return window.spiccioliLedger.getRecentFiles();
		}).then((files) => {
			if(isMounted) {
				setRecentFiles(files);
			}
		}).catch(() => {
			// A recent list that cannot be read is an empty one, which is a legitimate state of this screen
		});

		return () => {
			isMounted = false;
		};
	}, [ upgradePrompt ]);

	const dismissRecentFile = useCallback((filePath: string): void => {
		void window.spiccioliLedger.dismissRecentFile(filePath).then(setRecentFiles).catch(() => {
			// Nothing to recover: the entry stays until the next attempt
		});
	}, []);

	const describeFailure = (): string => {
		if(!openFailure) {
			return '';
		}

		return openFailure.kind === 'unreadable' ? openFailure.message : describeLedgerRefusal(openFailure.refusal, translator);
	};

	if(upgradePrompt) {
		return <UpgradeDialog/>;
	}

	return (
		<div className='launch-screen'>
			<div className='launch-screen-panel'>
				<h1 className='launch-screen-title'>{t('app.name')}</h1>
				<p className='launch-screen-subtitle'>{t('launch.subtitle')}</p>

				{openFailure && (
					<div className='launch-screen-failure' role='alert'>
						<p className='launch-screen-failure-file'>{getFileName(openFailure.filePath)}</p>
						<p className='launch-screen-failure-message'>{describeFailure()}</p>
						<button type='button' className='launch-screen-link' onClick={dismissOpenFailure}>{t('launch.dismiss')}</button>
					</div>
				)}

				{recentFiles.length === 0 ?
					<p className='launch-screen-empty'>{t('launch.noRecentFiles')}</p> :
					<ul className='launch-screen-recent'>
						{recentFiles.map((recentFile) => {
							return (
								<li key={recentFile.filePath} className='launch-screen-recent-row'>
									<button
										type='button'
										className='launch-screen-recent-file'
										disabled={recentFile.missing || isBusy}
										onClick={() => {
											void openPath(recentFile.filePath);
										}}>
										<span className={recentFile.missing ? 'launch-screen-recent-name launch-screen-recent-name-missing' : 'launch-screen-recent-name'}>
											{getFileName(recentFile.filePath)}
										</span>
										<span className='launch-screen-recent-detail'>
											{recentFile.missing ?
												t('launch.recentFileMissing', { directory: getDirectory(recentFile.filePath) }) :
												t('launch.recentFileDetail', {
													directory: getDirectory(recentFile.filePath),
													openedAt: formatter.dateAndTime(new Date(recentFile.lastOpenedAt))
												})}
										</span>
									</button>
									{recentFile.missing && (
										<button
											type='button'
											className='launch-screen-link'
											onClick={() => {
												dismissRecentFile(recentFile.filePath);
											}}>
											{t('launch.forget')}
										</button>
									)}
								</li>
							);
						})}
					</ul>}

				<div className='launch-screen-actions'>
					<button
						type='button'
						className='launch-screen-button'
						disabled={isBusy}
						onClick={() => {
							void openWithDialog();
						}}>
						{t('launch.open')}
					</button>
					<button
						type='button'
						className='launch-screen-button launch-screen-button-primary'
						disabled={isBusy}
						onClick={() => {
							void createWithDialog();
						}}>
						{t('launch.newFile')}
					</button>
				</div>
			</div>
		</div>
	);
};
