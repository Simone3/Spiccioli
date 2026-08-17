import 'src/components/common/RowMenu.css';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslator } from 'src/i18n/TranslationContext';

/**
 * What a row can have done to it: duplicate, delete, whatever the screen puts there.
 *
 * The trigger and every entry are real buttons, so the keyboard reaches them and the one focus ring has something to draw
 * around. Escape closes the menu and puts the keyboard back on the trigger; a click anywhere else closes it too.
 */

export interface RowMenuAction {
	key: string;
	label: string;
	onSelect: () => void;

	// A delete, which is the only kind of entry that is coloured, and which always confirms since there is no undo
	danger?: boolean;
	disabled?: boolean;
}

export interface RowMenuProps {
	actions: readonly RowMenuAction[];

	// What this row's menu is called, which is what tells one row's menu from another's
	label: string;
}

/**
 * A row's menu.
 * @param props The menu's props.
 * @param props.actions What can be done to the row.
 * @param props.label What this row's menu is called.
 * @returns The menu.
 */
export const RowMenu = ({ actions, label }: RowMenuProps): ReactElement => {
	const { t } = useTranslator();
	const [ isOpen, setIsOpen ] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if(!isOpen) {
			return undefined;
		}

		const closeOnOutsideClick = (event: MouseEvent): void => {
			if(!containerRef.current?.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		document.addEventListener('mousedown', closeOnOutsideClick);

		return () => {
			document.removeEventListener('mousedown', closeOnOutsideClick);
		};
	}, [ isOpen ]);

	const close = (): void => {
		setIsOpen(false);
		triggerRef.current?.focus();
	};

	return (
		<div
			className='row-menu'
			ref={containerRef}
			onKeyDown={(event) => {
				if(event.key === 'Escape' && isOpen) {
					close();
				}
			}}>
			<button
				type='button'
				className='row-menu-trigger'
				ref={triggerRef}
				aria-label={label}
				aria-haspopup='menu'
				aria-expanded={isOpen}
				onClick={() => {
					setIsOpen(!isOpen);
				}}>
				···
			</button>
			{isOpen && (
				<ul className='row-menu-list' role='menu' aria-label={label}>
					{actions.map((action) => {
						return (
							<li key={action.key} role='none'>
								<button
									type='button'
									role='menuitem'
									className={action.danger ? 'row-menu-item row-menu-item-danger' : 'row-menu-item'}
									disabled={action.disabled}
									onClick={() => {
										setIsOpen(false);
										action.onSelect();
									}}>
									{action.label}
								</button>
							</li>
						);
					})}
					{actions.length === 0 && <li className='row-menu-item'>{t('rowMenu.nothingToDo')}</li>}
				</ul>
			)}
		</div>
	);
};
