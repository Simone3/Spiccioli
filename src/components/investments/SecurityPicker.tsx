import { useMemo, type ReactElement } from 'react';
import { SelectField, type SelectOption } from 'src/components/common/SelectField';
import { useLedger } from 'src/contexts/LedgerContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { sortSecurities } from 'src/logic/investments/Securities';
import type { LedgerId } from 'src/types/LedgerTypes';

/**
 * **Every security picker in the application is this control**: a trade's, an inline edit's, a filter's.
 *
 * A security is offered as *ticker · name*, ordered by ticker like both tabs that list one, and **securities no longer held are
 * in the list like everything else** — a trade may be recorded against one long after the position was closed, and correcting an
 * old row must be able to reach it.
 */

// The entry a form opens on, until a security is chosen. It is never a value that is saved.
const NOTHING_CHOSEN = '';

export interface SecurityPickerProps {

	// The security chosen, or undefined while none is
	value: LedgerId | undefined;

	// Called with undefined only where choosing nothing is a value, which is a filter's "All" and never a form's empty field
	onChange: (securityId: LedgerId | undefined) => void;

	// Whether the entry that chooses no security is a choice
	clearable?: boolean;

	// What the control is called, since the label is the caller's to place
	label: string;

	// What it reads while nothing is chosen
	placeholder: string;
	disabled?: boolean;

	// Set by the caller when the form cannot be saved without a choice here
	refusal?: string;
}

/**
 * The one security picker.
 * @param props The picker's props.
 * @param props.value The security chosen, where one is.
 * @param props.onChange What to do with the security chosen.
 * @param props.clearable Whether choosing no security is itself a choice.
 * @param props.label What the control is called.
 * @param props.placeholder What it reads while nothing is chosen.
 * @param props.disabled Whether it can be changed.
 * @param props.refusal Why a choice is needed, where the form says one is.
 * @returns The picker.
 */
export const SecurityPicker = ({ value, onChange, clearable = false, label, placeholder, disabled, refusal }: SecurityPickerProps): ReactElement => {
	const { t } = useTranslator();
	const { document } = useLedger();

	const options = useMemo((): readonly SelectOption<string>[] => {
		const entries = sortSecurities(document?.securities ?? []).map((security) => {
			return { value: security.id, label: t('securities.option', { ticker: security.ticker, name: security.name }) };
		});

		return [ { value: NOTHING_CHOSEN, label: placeholder }, ...entries ];
	}, [ document, placeholder, t ]);

	return (
		<SelectField
			value={value ?? NOTHING_CHOSEN}
			options={options}
			label={label}
			disabled={disabled}
			refusal={refusal}
			onChange={(chosen) => {
				if(chosen !== NOTHING_CHOSEN) {
					onChange(chosen);
				}
				else if(clearable) {
					onChange(undefined);
				}
			}}/>
	);
};
