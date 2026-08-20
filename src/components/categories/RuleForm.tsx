import { useState, type ReactElement } from 'react';
import { CategoryPicker } from 'src/components/categories/CategoryPicker';
import { FormDialog, FormField } from 'src/components/common/FormDialog';
import { TextField } from 'src/components/common/TextField';
import { useTranslator } from 'src/i18n/TranslationContext';
import type { RuleValues } from 'src/logic/categories/RuleDraft';
import type { LedgerId, Rule } from 'src/types/LedgerTypes';

/**
 * The form a rule is written in: **a substring and a category, and nothing else**.
 *
 * The match is case- and accent-insensitive and is made on the description alone, so there is nothing here to configure about
 * it. **Saving writes nothing** — it puts the rule into the draft, and the draft is applied once, against its consequence
 * summary.
 */

export interface RuleFormProps {

	// The rule being corrected, or undefined for one being added
	rule: Rule | undefined;

	onSave: (values: RuleValues) => void;
	onCancel: () => void;
}

// What the picker holds while no category has been chosen, which is a form that cannot be saved rather than a value
const NO_CATEGORY = '';

/**
 * The rule form.
 * @param props The form's props.
 * @param props.rule The rule being corrected, where one is.
 * @param props.onSave What saving does, which is to change the draft and nothing else.
 * @param props.onCancel What cancelling does.
 * @returns The form.
 */
export const RuleForm = ({ rule, onSave, onCancel }: RuleFormProps): ReactElement => {
	const { t } = useTranslator();
	const [ substring, setSubstring ] = useState(rule?.substring ?? '');
	const [ categoryId, setCategoryId ] = useState<LedgerId>(rule?.categoryId ?? NO_CATEGORY);

	const trimmed = substring.trim();
	const canSave = trimmed !== '' && categoryId !== NO_CATEGORY;

	return (
		<FormDialog
			title={rule ? t('rules.form.editTitle') : t('rules.form.addTitle')}
			canSave={canSave}
			onSave={() => {
				onSave({ substring: trimmed, categoryId });
			}}
			onCancel={onCancel}>
			<FormField label={t('rules.form.substring')} hint={t('rules.form.substringHint')}>
				<TextField
					value={substring}
					label={t('rules.form.substring')}
					placeholder={t('rules.form.substringPlaceholder')}
					onChange={setSubstring}/>
			</FormField>

			<FormField label={t('rules.form.category')}>
				<CategoryPicker value={categoryId} mode='rule' label={t('rules.form.category')} onChange={setCategoryId}/>
			</FormField>
		</FormDialog>
	);
};
