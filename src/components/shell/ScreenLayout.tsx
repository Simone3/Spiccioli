import 'src/components/shell/ScreenLayout.css';
import type { ReactElement, ReactNode } from 'react';
import { useTranslator } from 'src/i18n/TranslationContext';

/**
 * The shape every screen has: a heading, whatever the screen puts beside it, and the screen itself.
 * It is layout and nothing else — no screen's own rules live here.
 */

export interface ScreenLayoutProps {
	title: string;

	// The line under the title: a count, a reach, whatever the screen states about what it is showing
	subtitle?: string;

	// The controls in the top right, where the screen has any
	actions?: ReactNode;

	children: ReactNode;
}

/**
 * A screen.
 * @param props The layout's props.
 * @param props.title What the screen is called.
 * @param props.subtitle What it says about what it is showing.
 * @param props.actions The controls beside the heading.
 * @param props.children The screen.
 * @returns The layout.
 */
export const ScreenLayout = ({ title, subtitle, actions, children }: ScreenLayoutProps): ReactElement => {
	return (
		<div className='screen-layout'>
			<div className='screen-layout-head'>
				<div className='screen-layout-heading'>
					<h1 className='screen-layout-title'>{title}</h1>
					{subtitle && <span className='screen-layout-subtitle'>{subtitle}</span>}
				</div>
				{actions && <div className='screen-layout-actions'>{actions}</div>}
			</div>
			<div className='screen-layout-body'>{children}</div>
		</div>
	);
};

/**
 * What a screen says while it is still a shell: its data is in the file and the screen that reads it is built in a later phase.
 * It is not an empty state — a screen with nothing in it says what fills it instead — and it goes away as each screen is built.
 * @returns The note.
 */
export const ScreenNotBuiltYet = (): ReactElement => {
	const { t } = useTranslator();

	return <p className='screen-layout-note'>{t('screens.notBuiltYet')}</p>;
};
