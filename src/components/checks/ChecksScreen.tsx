import 'src/components/checks/ChecksScreen.css';
import type { ReactElement } from 'react';
import { useFollowCheckLink } from 'src/components/shell/RecordLinks';
import { ScreenLayout } from 'src/components/shell/ScreenLayout';
import { useChecks } from 'src/contexts/ChecksContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import type { CheckResult, CheckSide } from 'src/logic/checks/Checks';

/**
 * Checks: the fourteen, in the order of [§9], failing and passing alike.
 *
 * **This screen is never empty.** A check with nothing to examine passes and says so — “0 payslips” — which is why every passing
 * check states its reach, and why a check that passed because there was nothing there is distinguishable from one that passed
 * properly.
 *
 * **Nothing sorts a failure to the top.** A screen read every day is worth more when each check is where it was last time, and
 * how many are failing is already in the sidebar badge.
 *
 * **A failing check names at most five records and states the whole count**, and that is a full state rather than a truncated
 * one: there is no *show all*, no paging inside a check and no scrolling list. The fix for a check naming two hundred records is
 * the screen the records live on, which is one click away through any of the five entries.
 */

/**
 * The Checks screen.
 * @returns The screen.
 */
export const ChecksScreen = (): ReactElement => {
	const { t } = useTranslator();
	const { results } = useChecks();
	const followLink = useFollowCheckLink();

	const checks = results ?? [];
	const failing = checks.filter((check) => {
		return !check.passed;
	}).length;

	// Nothing has been computed until the first run lands, and a heading is not written about a state nobody has established yet
	const describeRun = (): string | undefined => {
		if(results === undefined) {
			return undefined;
		}

		return failing === 0 ?
			t('checks.allPassing', { total: checks.length }) :
			t('checks.summary', { total: checks.length, passing: checks.length - failing, failing });
	};

	const renderSide = (side: CheckSide): ReactElement => {
		return (
			<div key={side.key} className='checks-screen-side'>
				{side.label && <p className='checks-screen-side-label'>{side.label}</p>}
				<div className='checks-screen-entries'>
					{side.entries.map((entry) => {
						return (
							<button
								key={entry.key}
								type='button'
								className='checks-screen-entry'
								onClick={() => {
									followLink(entry.link);
								}}>
								{entry.text}
							</button>
						);
					})}
				</div>
				<p className='checks-screen-side-count'>
					{side.total > side.entries.length ?
						t('checks.showingSome', { shown: side.entries.length, count: side.total }) :
						t('checks.showingAll', { count: side.total })}
				</p>
			</div>
		);
	};

	// The sentence under a check's name, in the reading today's preferences give it. Every threshold in it is the preference
	// that set it, so it is a real control and the way to Settings rather than a figure the reader has to go and look for.
	const renderDescription = (check: CheckResult): ReactElement => {
		return (
			<p className='checks-screen-description'>
				{check.description.map((part) => {
					const link = part.link;

					if(!link) {
						return <span key={part.key}>{part.text}</span>;
					}

					return (
						<button
							key={part.key}
							type='button'
							className='checks-screen-threshold'
							aria-label={t('checks.thresholdLink', { value: part.text })}
							onClick={() => {
								followLink(link);
							}}>
							{part.text}
						</button>
					);
				})}
			</p>
		);
	};

	const renderCheck = (check: CheckResult): ReactElement => {
		return (
			<div key={check.id} className='checks-screen-check'>
				<span
					className={`checks-screen-state checks-screen-state-${check.passed ? 'passed' : 'failed'}`}
					role='img'
					aria-label={t(check.passed ? 'checks.passed' : 'checks.failed')}>
					{check.passed ? '✓' : '✕'}
				</span>
				<div className='checks-screen-body'>
					<p className='checks-screen-name'>{t(`checks.items.${check.id}.name`)}</p>
					{renderDescription(check)}
					{check.sides.map(renderSide)}
				</div>
				<span className={check.passed ? 'checks-screen-reach' : 'checks-screen-reach checks-screen-reach-failed'}>
					{check.reach}
				</span>
			</div>
		);
	};

	return (
		<ScreenLayout title={t('screens.checks')} subtitle={describeRun()}>
			<div className='checks-screen-list'>
				{checks.map(renderCheck)}
			</div>
		</ScreenLayout>
	);
};
