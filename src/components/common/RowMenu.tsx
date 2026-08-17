import 'src/components/common/RowMenu.css';
import { useCallback, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { useTranslator } from 'src/i18n/TranslationContext';

/**
 * What a row can have done to it: duplicate, delete, whatever the screen puts there.
 *
 * The trigger and every entry are real buttons, so the keyboard reaches them and the one focus ring has something to draw
 * around. Opening the menu puts the keyboard on its first entry; Escape closes it and puts the keyboard back on the trigger; a
 * click anywhere else closes it too.
 *
 * **The menu is drawn at the top of the document rather than inside the row**, because a table scrolls sideways and a scrolling
 * box clips what hangs out of it in both directions — a menu on the last row would otherwise be cut off at the table's edge. It
 * is therefore positioned against the trigger and follows it while anything under it scrolls.
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

interface RowMenuPosition {
	top: number;
	right: number;
}

// Between the trigger and the menu, and between the menu and the edge of the window it may not be pushed past
const MENU_GAP_PIXELS = 4;

const WINDOW_MARGIN_PIXELS = 8;

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
	const [ position, setPosition ] = useState<RowMenuPosition>({ top: 0, right: 0 });
	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLUListElement>(null);

	// The menu hangs under the trigger, and goes above it instead when there is no room left below
	const placeMenu = useCallback((): void => {
		const trigger = triggerRef.current?.getBoundingClientRect();

		if(!trigger) {
			return;
		}

		const height = menuRef.current?.offsetHeight ?? 0;
		const below = trigger.bottom + MENU_GAP_PIXELS;
		const fitsBelow = below + height <= window.innerHeight - WINDOW_MARGIN_PIXELS;

		setPosition({
			top: fitsBelow ? below : Math.max(WINDOW_MARGIN_PIXELS, trigger.top - MENU_GAP_PIXELS - height),
			right: Math.max(WINDOW_MARGIN_PIXELS, window.innerWidth - trigger.right)
		});
	}, []);

	useLayoutEffect(() => {
		if(!isOpen) {
			return undefined;
		}

		placeMenu();
		menuRef.current?.querySelector('button')?.focus();

		const closeOnOutsideClick = (event: MouseEvent): void => {
			const target = event.target as Node;

			if(!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
				setIsOpen(false);
			}
		};

		// The menu is positioned against the trigger, so it follows whatever is scrolled or resized under it
		document.addEventListener('mousedown', closeOnOutsideClick);
		window.addEventListener('scroll', placeMenu, true);
		window.addEventListener('resize', placeMenu);

		return () => {
			document.removeEventListener('mousedown', closeOnOutsideClick);
			window.removeEventListener('scroll', placeMenu, true);
			window.removeEventListener('resize', placeMenu);
		};
	}, [ isOpen, placeMenu ]);

	const close = (): void => {
		setIsOpen(false);
		triggerRef.current?.focus();
	};

	const closeOnEscape = (event: { key: string }): void => {
		if(event.key === 'Escape') {
			close();
		}
	};

	return (
		<div className='row-menu' onKeyDown={closeOnEscape}>
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
			{isOpen && createPortal(
				<ul
					className='row-menu-list'
					ref={menuRef}
					role='menu'
					aria-label={label}
					style={{ top: position.top, right: position.right }}
					onKeyDown={closeOnEscape}>
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
				</ul>,
				document.body
			)}
		</div>
	);
};
