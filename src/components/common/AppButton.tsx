import 'src/components/common/AppButton.css';
import { Link } from 'react-router';
import type { ReactElement, ReactNode } from 'react';

/**
 * The one button, and the one link that looks like one.
 *
 * Anything the user can click is a real control rather than a clickable div, so the keyboard reaches it and activates it, and
 * the focus ring of "src/index.css" has something to draw around. Neither of these draws a focus style of its own.
 *
 * The link is where "react-router" meets a screen: nothing outside this file and the shell imports the router, so a screen
 * saying "go to Accounts" says it in Spiccioli's own words.
 */

export type AppButtonVariant = 'secondary' | 'primary' | 'ghost' | 'danger';

const VARIANT_CLASS_NAMES: Record<AppButtonVariant, string> = {
	secondary: '',
	primary: ' app-button-primary',
	ghost: ' app-button-ghost',
	danger: ' app-button-danger'
};

export interface AppButtonProps {
	children: ReactNode;
	onClick: () => void;
	variant?: AppButtonVariant;
	disabled?: boolean;

	// What the keyboard and a screen reader read when the label on the button is an icon rather than a word
	label?: string;
}

export interface AppLinkButtonProps {
	children: ReactNode;

	// A route of "src/components/shell/AppRoutes.ts", never a URL of its own
	to: string;
	variant?: AppButtonVariant;
}

/**
 * A button.
 * @param props The button's props.
 * @param props.children What it says.
 * @param props.onClick What it does.
 * @param props.variant Which of the four it is, secondary by default.
 * @param props.disabled Whether it can be pressed.
 * @param props.label What it is called, where what it says is not a word.
 * @returns The button.
 */
export const AppButton = ({ children, onClick, variant = 'secondary', disabled = false, label }: AppButtonProps): ReactElement => {
	return (
		<button
			type='button'
			className={`app-button${VARIANT_CLASS_NAMES[variant]}`}
			disabled={disabled}
			aria-label={label}
			onClick={onClick}>
			{children}
		</button>
	);
};

/**
 * A link to another screen, wearing the button's clothes. It is an anchor, so it opens where a link opens and the keyboard
 * follows it the way it follows every other link.
 * @param props The link's props.
 * @param props.children What it says.
 * @param props.to Which screen it goes to.
 * @param props.variant Which of the four it is, secondary by default.
 * @returns The link.
 */
export const AppLinkButton = ({ children, to, variant = 'secondary' }: AppLinkButtonProps): ReactElement => {
	return (
		<Link className={`app-button${VARIANT_CLASS_NAMES[variant]}`} to={to}>
			{children}
		</Link>
	);
};
