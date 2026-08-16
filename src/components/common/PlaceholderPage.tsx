import 'src/components/common/PlaceholderPage.css';
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslator } from 'src/i18n/TranslationContext';
import type { SpiccioliAppInfo } from 'src/types/AppInfoTypes';

/**
 * The one screen there is until the real ones are built.
 *
 * It reads the build information over the preload bridge rather than printing something the renderer already knows, so that a run
 * of the application shows at a glance that the renderer, the preload bridge and the main process are all wired to each other.
 * This screen goes away with the launch screen of the functional analysis.
 * @returns The placeholder screen.
 */
const PlaceholderPage = (): ReactElement => {
	const { t } = useTranslator();
	const [ appInfo, setAppInfo ] = useState<SpiccioliAppInfo | undefined>();
	const [ hasFailed, setHasFailed ] = useState(false);

	useEffect(() => {
		let isMounted = true;

		// Started inside a promise rather than called directly, so that a preload script that did not run leaves the bridge undefined
		// and is reported like any other failure to answer, instead of throwing out of the effect and emptying the window
		void Promise.resolve().then(() => {
			return window.spiccioliAppInfo.getAppInfo();
		}).then((info) => {
			if(isMounted) {
				setAppInfo(info);
			}
		}).catch(() => {
			if(isMounted) {
				setHasFailed(true);
			}
		});

		return () => {
			isMounted = false;
		};
	}, []);

	return (
		<div className='placeholder-page'>
			<h1 className='placeholder-page-title'>{t('placeholder.title')}</h1>
			<p className='placeholder-page-message'>{t('placeholder.message')}</p>
			<p className='placeholder-page-environment'>
				{hasFailed && t('placeholder.environmentUnavailable')}
				{appInfo && t('placeholder.environment', {
					version: appInfo.version,
					platform: appInfo.platform
				})}
			</p>
		</div>
	);
};

export { PlaceholderPage };
