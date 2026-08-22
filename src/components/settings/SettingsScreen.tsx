import 'src/components/settings/SettingsScreen.css';
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { IntegerField, PercentageField } from 'src/components/common/NumericFields';
import { SelectField, type SelectOption } from 'src/components/common/SelectField';
import { ScreenLayout } from 'src/components/shell/ScreenLayout';
import { useLedger } from 'src/contexts/LedgerContext';
import { usePreferences } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { separatorsCollide } from 'src/logic/preferences/Preferences';
import {
	DATE_FORMATS,
	DECIMAL_SEPARATORS,
	PENSION_CONTRIBUTION_PERIODS,
	THOUSANDS_SEPARATORS,
	type DateFormat,
	type DecimalSeparator,
	type Preferences,
	type ThousandsSeparator
} from 'src/types/PreferencesTypes';

/**
 * Settings: the preferences, and nothing else.
 *
 * **There is no save button.** A preference applies as it is changed and is written to the installation's own store
 * immediately; a value that cannot be applied is refused in place and the previous one stays in force. **Nothing here ever marks
 * the data file as modified** — the preferences are not in it, which is what the line at the top says.
 *
 * The two path rows are read-only facts about the session: where the open file is, and where its copies are.
 */

// The preferences this screen carries, which is all of them
const PREFERENCE_COUNT = 12;

// Only the field's own floor and ceiling live here; every other rule about a preference is the field's
const UNBOUNDED = undefined;

const MATCH_WINDOW_MAXIMUM_DAYS = 31;

const BACKUP_COUNT_MINIMUM = 1;

const BACKUP_COUNT_MAXIMUM = 100;

interface SettingsGroupProps {
	title: string;
	children: ReactNode;
}

// A group is what it is called in the gutter and its rows beside it, all three sharing the one panel the screen is
const SettingsGroup = ({ title, children }: SettingsGroupProps): ReactElement => {
	return (
		<section className='settings-screen-group'>
			<h2 className='settings-screen-group-title'>{title}</h2>
			<div className='settings-screen-rows'>{children}</div>
		</section>
	);
};

interface SettingsFieldProps {
	label: string;
	children: ReactNode;
}

const SettingsField = ({ label, children }: SettingsFieldProps): ReactElement => {
	return (
		<div className='settings-screen-row'>
			<span className='settings-screen-field-label'>{label}</span>
			{children}
		</div>
	);
};

/**
 * The Settings screen.
 * @returns The screen.
 */
export const SettingsScreen = (): ReactElement => {
	const { t } = useTranslator();
	const { preferences, setPreferences } = usePreferences();
	const { filePath } = useLedger();
	const [ backupDirectory, setBackupDirectory ] = useState<string | undefined>(undefined);
	const [ separatorRefusal, setSeparatorRefusal ] = useState<'decimal' | 'thousands' | undefined>(undefined);

	useEffect(() => {
		let isMounted = true;

		void Promise.resolve().then(() => {
			return window.spiccioliLedger.getBackupDirectory();
		}).then((directory) => {
			if(isMounted) {
				setBackupDirectory(directory);
			}
		}).catch(() => {
			// A folder that cannot be named is a row that says so, which is what an undefined path already reads as
		});

		return () => {
			isMounted = false;
		};
	}, [ filePath ]);

	const apply = <TKey extends keyof Preferences>(key: TKey, value: Preferences[TKey]): void => {
		setPreferences({ ...preferences, [key]: value });
	};

	// A number that is refused by its own field never reaches here, so an undefined value is a field being emptied and is not applied
	const applyNumber = (key: keyof Preferences, value: number | undefined): void => {
		if(value !== undefined) {
			apply(key, value as Preferences[typeof key]);
		}
	};

	const dateFormatOptions: readonly SelectOption<DateFormat>[] = DATE_FORMATS.map((dateFormat) => {
		return { value: dateFormat, label: dateFormat };
	});

	const decimalSeparatorOptions: readonly SelectOption<DecimalSeparator>[] = DECIMAL_SEPARATORS.map((separator) => {
		return { value: separator, label: t(`settings.separators.${separator}`) };
	});

	const thousandsSeparatorOptions: readonly SelectOption<ThousandsSeparator>[] = THOUSANDS_SEPARATORS.map((separator) => {
		return { value: separator, label: t(`settings.separators.${separator}`) };
	});

	// A closed set rather than a number to type: the lengths that divide a year are the only ones a period may have. The picker
	// is over strings, a select carrying no other kind of value, so the number is written out here and read back on the way in.
	const pensionContributionOptions: readonly SelectOption<string>[] = PENSION_CONTRIBUTION_PERIODS.map((months) => {
		return { value: String(months), label: t('settings.pensionContributionPeriods', { count: months }) };
	});

	// The two separators must differ, and "none" never collides. A choice that collides is refused with the previous one left in force.
	const changeDecimalSeparator = (value: DecimalSeparator): void => {
		if(separatorsCollide(value, preferences.thousandsSeparator)) {
			setSeparatorRefusal('decimal');

			return;
		}

		setSeparatorRefusal(undefined);
		apply('decimalSeparator', value);
	};

	const changeThousandsSeparator = (value: ThousandsSeparator): void => {
		if(separatorsCollide(value, preferences.decimalSeparator)) {
			setSeparatorRefusal('thousands');

			return;
		}

		setSeparatorRefusal(undefined);
		apply('thousandsSeparator', value);
	};

	return (
		<ScreenLayout title={t('screens.settings')} subtitle={t('settings.preferenceCount', { count: PREFERENCE_COUNT })}>
			<p className='settings-screen-scope'>
				<strong>{t('settings.scopeTitle')}</strong> {t('settings.scopeExplanation')}
			</p>

			<div className='settings-screen-sheet'>
				<SettingsGroup title={t('settings.formats')}>
					<SettingsField label={t('settings.dateFormat')}>
						<SelectField
							value={preferences.dateFormat}
							options={dateFormatOptions}
							label={t('settings.dateFormat')}
							onChange={(value) => {
								apply('dateFormat', value);
							}}/>
					</SettingsField>
					<SettingsField label={t('settings.decimalSeparator')}>
						<SelectField
							value={preferences.decimalSeparator}
							options={decimalSeparatorOptions}
							label={t('settings.decimalSeparator')}
							refusal={separatorRefusal === 'decimal' ? t('settings.separatorsMustDiffer') : undefined}
							onChange={changeDecimalSeparator}/>
					</SettingsField>
					<SettingsField label={t('settings.thousandsSeparator')}>
						<SelectField
							value={preferences.thousandsSeparator}
							options={thousandsSeparatorOptions}
							label={t('settings.thousandsSeparator')}
							refusal={separatorRefusal === 'thousands' ? t('settings.separatorsMustDiffer') : undefined}
							onChange={changeThousandsSeparator}/>
					</SettingsField>
				</SettingsGroup>

				<SettingsGroup title={t('settings.thresholds')}>
					<SettingsField label={t('settings.defaultTaxRate')}>
						<PercentageField
							value={preferences.defaultTaxRate}
							label={t('settings.defaultTaxRate')}
							required
							onChange={(value) => {
								applyNumber('defaultTaxRate', value);
							}}/>
					</SettingsField>
					<SettingsField label={t('settings.priceStalenessDays')}>
						<IntegerField
							value={preferences.priceStalenessDays}
							label={t('settings.priceStalenessDays')}
							minimum={1}
							maximum={UNBOUNDED}
							required
							suffix={t('settings.units.days')}
							onChange={(value) => {
								applyNumber('priceStalenessDays', value);
							}}/>
					</SettingsField>
					<SettingsField label={t('settings.pensionRevaluationMonths')}>
						<IntegerField
							value={preferences.pensionRevaluationMonths}
							label={t('settings.pensionRevaluationMonths')}
							minimum={1}
							required
							suffix={t('settings.units.months')}
							onChange={(value) => {
								applyNumber('pensionRevaluationMonths', value);
							}}/>
					</SettingsField>
					<SettingsField label={t('settings.receiptPendingMonths')}>
						<IntegerField
							value={preferences.receiptPendingMonths}
							label={t('settings.receiptPendingMonths')}
							minimum={1}
							required
							suffix={t('settings.units.months')}
							onChange={(value) => {
								applyNumber('receiptPendingMonths', value);
							}}/>
					</SettingsField>
					<SettingsField label={t('settings.transferMatchWindowDays')}>
						<IntegerField
							value={preferences.transferMatchWindowDays}
							label={t('settings.transferMatchWindowDays')}
							minimum={0}
							maximum={MATCH_WINDOW_MAXIMUM_DAYS}
							required
							suffix={t('settings.units.days')}
							onChange={(value) => {
								applyNumber('transferMatchWindowDays', value);
							}}/>
					</SettingsField>
					<SettingsField label={t('settings.transferMatchBackwardDays')}>
						<IntegerField
							value={preferences.transferMatchBackwardDays}
							label={t('settings.transferMatchBackwardDays')}
							minimum={0}
							maximum={MATCH_WINDOW_MAXIMUM_DAYS}
							required
							suffix={t('settings.units.days')}
							onChange={(value) => {
								applyNumber('transferMatchBackwardDays', value);
							}}/>
					</SettingsField>
					<SettingsField label={t('settings.tradeMatchWindowDays')}>
						<IntegerField
							value={preferences.tradeMatchWindowDays}
							label={t('settings.tradeMatchWindowDays')}
							minimum={0}
							maximum={MATCH_WINDOW_MAXIMUM_DAYS}
							required
							suffix={t('settings.units.days')}
							onChange={(value) => {
								applyNumber('tradeMatchWindowDays', value);
							}}/>
					</SettingsField>
					<SettingsField label={t('settings.pensionContributionMonths')}>
						<SelectField
							value={String(preferences.pensionContributionMonths)}
							options={pensionContributionOptions}
							label={t('settings.pensionContributionMonths')}
							onChange={(value) => {
								applyNumber('pensionContributionMonths', Number(value));
							}}/>
					</SettingsField>
				</SettingsGroup>

				<SettingsGroup title={t('settings.file')}>
					<SettingsField label={t('settings.backupCount')}>
						<IntegerField
							value={preferences.backupCount}
							label={t('settings.backupCount')}
							minimum={BACKUP_COUNT_MINIMUM}
							maximum={BACKUP_COUNT_MAXIMUM}
							required
							onChange={(value) => {
								applyNumber('backupCount', value);
							}}/>
					</SettingsField>

					<dl className='settings-screen-paths'>
						<div className='settings-screen-path'>
							<dt>{t('settings.dataFile')}</dt>
							<dd>{filePath ?? t('settings.pathUnknown')}</dd>
						</div>
						<div className='settings-screen-path'>
							<dt>{t('settings.backupFolder')}</dt>
							<dd>{backupDirectory ?? t('settings.pathUnknown')}</dd>
						</div>
					</dl>
				</SettingsGroup>
			</div>
		</ScreenLayout>
	);
};
