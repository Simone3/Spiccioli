import { useMemo, type ReactElement } from 'react';
import { SelectField, type SelectOption } from 'src/components/common/SelectField';
import { useLedger } from 'src/contexts/LedgerContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { buildAccountPickerEntries, type AccountSide } from 'src/logic/accounts/Accounts';
import type { LedgerId } from 'src/types/LedgerTypes';

/**
 * **Every account picker in the application is this control**: a transaction's, a trade's, an import's, a filter's.
 *
 * It offers **one side of the cash/brokerage boundary and never the other**, which is why no screen anywhere has an invalid
 * account to reject: a transaction is never offered a `Brokerage` account and a trade is never offered a cash one. **Closed
 * accounts stay in every picker**, marked as closed and after the open ones, since their history is still being read.
 *
 * An account is written *Institution · Account*, this being one of the many places the institution has no column of its own.
 */

// The entry a form opens on, until an account is chosen. It is never a value that is saved.
const NOTHING_CHOSEN = '';

export interface AccountPickerProps {

	// The account chosen, or undefined while none is
	value: LedgerId | undefined;

	onChange: (accountId: LedgerId) => void;

	// Which half of the boundary this picker is on
	side: AccountSide;

	// What the control is called, since the label is the caller's to place
	label: string;

	// What it reads while nothing is chosen
	placeholder: string;
	disabled?: boolean;

	// Set by the caller when the form cannot be saved without a choice here
	refusal?: string;
}

/**
 * The one account picker.
 * @param props The picker's props.
 * @param props.value The account chosen, where one is.
 * @param props.onChange What to do with the account chosen.
 * @param props.side Which half of the cash/brokerage boundary it offers.
 * @param props.label What the control is called.
 * @param props.placeholder What it reads while nothing is chosen.
 * @param props.disabled Whether it can be changed.
 * @param props.refusal Why a choice is needed, where the form says one is.
 * @returns The picker.
 */
export const AccountPicker = ({ value, onChange, side, label, placeholder, disabled, refusal }: AccountPickerProps): ReactElement => {
	const translator = useTranslator();
	const { document } = useLedger();

	const options = useMemo((): readonly SelectOption<string>[] => {
		const entries = buildAccountPickerEntries({
			accounts: document?.accounts ?? [],
			institutions: document?.institutions ?? [],
			side,
			translator
		});

		return [ { value: NOTHING_CHOSEN, label: placeholder }, ...entries.map((entry) => {
			return { value: entry.id, label: entry.label };
		}) ];
	}, [ document, placeholder, side, translator ]);

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
			}}/>
	);
};
