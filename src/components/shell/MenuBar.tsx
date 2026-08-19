import 'src/components/shell/MenuBar.css';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslator } from 'src/i18n/TranslationContext';
import type { SpiccioliMenu, SpiccioliMenuCommandRequest, SpiccioliMenuItem } from 'src/types/AppMenuTypes';

/**
 * The menu bar Spiccioli draws itself, on the platform where the native one cannot be made to look like the rest of the application.
 *
 * It behaves like the menu bar it replaces: a submenu opens on the first click and every other one then opens on hover, the keyboard
 * walks it with the arrow keys, and Escape closes it. **Open Recent is a submenu of its own**, which the pointer opens by resting on
 * it and the keyboard opens with the right arrow, exactly as the native menu does; it is the only nesting the menu has.
 *
 * What it deliberately does not do is take the focus. The Edit entries act on whatever the user was typing in, and focus moved onto
 * a menu button would be focus taken away from that field, so the pointer is kept from moving it and the entry the keyboard is on is
 * a highlight this component holds rather than the focused element. The bar itself is still reachable by keyboard, because the
 * submenu titles are ordinary buttons.
 */

export interface MenuBarProps {
	menus: SpiccioliMenu[];
	onCommand: (request: SpiccioliMenuCommandRequest) => void;
}

// A row the keyboard can land on. A separator is not one, and neither is the row that says a recent file has moved: both say
// something and do nothing.
const isNavigable = (item: SpiccioliMenuItem | undefined): boolean => {
	return item?.type === 'entry' || item?.type === 'submenu';
};

// Where the row after (or before) the one at "fromIndex" is, skipping what cannot be landed on and wrapping around the ends.
// Nothing is highlighted yet at -1, and a step down from there has to land on the first row and a step up on the last.
const findRowIndex = (items: SpiccioliMenuItem[], fromIndex: number, step: number): number => {
	let index = fromIndex === -1 && step < 0 ? items.length : fromIndex;

	for(let attempt = 0; attempt < items.length; attempt++) {
		index = (index + step + items.length) % items.length;

		if(isNavigable(items[index])) {
			return index;
		}
	}

	return -1;
};

export const MenuBar = ({ menus, onCommand }: MenuBarProps): ReactElement => {
	const { t } = useTranslator();

	const [ openMenuId, setOpenMenuId ] = useState<string | undefined>();

	// Which row of the open submenu the keyboard is on, as an index into its items, or -1 when the pointer is driving the menu
	const [ highlightedIndex, setHighlightedIndex ] = useState(-1);

	// Which row of the open submenu has its own submenu open — Open Recent and nothing else — and which of its rows is highlighted
	const [ openNestedIndex, setOpenNestedIndex ] = useState(-1);
	const [ nestedHighlightedIndex, setNestedHighlightedIndex ] = useState(-1);

	const barRef = useRef<HTMLDivElement>(null);
	const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

	const openMenu = menus.find((menu) => {
		return menu.id === openMenuId;
	});
	const openNestedItem = openMenu?.items[openNestedIndex];
	const nestedItems = openNestedItem?.type === 'submenu' ? openNestedItem.items : undefined;

	const closeNested = (): void => {
		setOpenNestedIndex(-1);
		setNestedHighlightedIndex(-1);
	};

	const closeMenu = (): void => {
		setOpenMenuId(undefined);
		setHighlightedIndex(-1);
		closeNested();
	};

	const openMenuAt = (menuIndex: number, rowIndex: number): void => {
		const menu = menus[menuIndex];

		if(menu) {
			setOpenMenuId(menu.id);
			setHighlightedIndex(rowIndex);
			closeNested();
		}
	};

	const openNestedAt = (rowIndex: number, nestedRowIndex: number): void => {
		setHighlightedIndex(rowIndex);
		setOpenNestedIndex(rowIndex);
		setNestedHighlightedIndex(nestedRowIndex);
	};

	const focusTrigger = (menuIndex: number): void => {
		const menu = menus[(menuIndex + menus.length) % menus.length];

		if(menu) {
			triggerRefs.current[menu.id]?.focus();
		}
	};

	const runItem = (item: SpiccioliMenuItem | undefined, itemIndex: number): void => {
		if(item?.type === 'entry') {
			closeMenu();
			onCommand({ command: item.command, filePath: item.filePath });
		}

		// A row that only holds more rows opens them instead of doing anything itself
		else if(item?.type === 'submenu') {
			openNestedAt(itemIndex, -1);
		}
	};

	useEffect(() => {
		if(!openMenu) {
			return undefined;
		}

		const openMenuIndex = menus.indexOf(openMenu);

		// The keys are taken in the capture phase, because the field the user was typing in still holds the focus while the menu is
		// open: an arrow key that reached it would move the caret behind the menu instead of moving through it
		const onDocumentKeyDown = (event: KeyboardEvent): void => {
			switch(event.key) {
				case 'Escape':

					// The nested submenu closes first, leaving the menu it hangs off open, which is what every menu bar does
					if(nestedItems) {
						closeNested();
						break;
					}

					closeMenu();

					// The focus only goes back to the submenu title when it came from there, so a menu opened with the pointer leaves
					// the field the user was typing in exactly where it was
					if(barRef.current?.contains(document.activeElement)) {
						triggerRefs.current[openMenu.id]?.focus();
					}
					break;

				case 'ArrowDown':
					if(nestedItems) {
						setNestedHighlightedIndex(findRowIndex(nestedItems, nestedHighlightedIndex, 1));
					}
					else {
						setHighlightedIndex(findRowIndex(openMenu.items, highlightedIndex, 1));
					}
					break;

				case 'ArrowUp':
					if(nestedItems) {
						setNestedHighlightedIndex(findRowIndex(nestedItems, nestedHighlightedIndex, -1));
					}
					else {
						setHighlightedIndex(findRowIndex(openMenu.items, highlightedIndex, -1));
					}
					break;

				case 'ArrowRight': {
					const highlightedItem = openMenu.items[highlightedIndex];

					// The right arrow opens the submenu the keyboard is on, and moves to the next menu of the bar when it is not on one
					if(!nestedItems && highlightedItem?.type === 'submenu') {
						openNestedAt(highlightedIndex, findRowIndex(highlightedItem.items, -1, 1));
					}
					else {
						openMenuAt((openMenuIndex + 1) % menus.length, -1);
					}
					break;
				}

				case 'ArrowLeft':
					if(nestedItems) {
						closeNested();
					}
					else {
						openMenuAt((openMenuIndex - 1 + menus.length) % menus.length, -1);
					}
					break;

				case 'Home':
					if(nestedItems) {
						setNestedHighlightedIndex(findRowIndex(nestedItems, -1, 1));
					}
					else {
						setHighlightedIndex(findRowIndex(openMenu.items, -1, 1));
					}
					break;

				case 'End':
					if(nestedItems) {
						setNestedHighlightedIndex(findRowIndex(nestedItems, -1, -1));
					}
					else {
						setHighlightedIndex(findRowIndex(openMenu.items, -1, -1));
					}
					break;

				case 'Enter':
				case ' ':
					if(nestedItems) {
						runItem(nestedItems[nestedHighlightedIndex], nestedHighlightedIndex);
					}
					else {
						runItem(openMenu.items[highlightedIndex], highlightedIndex);
					}
					break;

				case 'Tab':
					closeMenu();
					return;

				default:
					return;
			}

			// Everything the menu answered is the menu's alone: the page behind it must not see it as well
			event.preventDefault();
			event.stopPropagation();
		};

		// A click anywhere else closes the menu, and it is taken on the press so that the click itself still reaches whatever was under it
		const onDocumentMouseDown = (event: MouseEvent): void => {
			if(!barRef.current?.contains(event.target as Node)) {
				closeMenu();
			}
		};

		document.addEventListener('keydown', onDocumentKeyDown, true);
		document.addEventListener('mousedown', onDocumentMouseDown, true);

		return () => {
			document.removeEventListener('keydown', onDocumentKeyDown, true);
			document.removeEventListener('mousedown', onDocumentMouseDown, true);
		};

		// Deliberately without a dependency list: the handlers read the open submenu and the highlighted rows, so they are the ones
		// this render built. There is nothing to save by keeping an older set of them registered.
	});

	const renderRow = (item: SpiccioliMenuItem, itemIndex: number, isHighlighted: boolean, isNested: boolean): ReactElement => {
		if(item.type === 'separator') {
			return <div className='menu-bar-separator' role='separator' key={`separator-${itemIndex}`}/>;
		}

		// A recent file that has moved, and the row that says there are none at all: both are read and neither is a control
		if(item.type === 'label') {
			return <div className='menu-bar-label' key={`label-${itemIndex}`}>{item.label}</div>;
		}

		const isSubmenu = item.type === 'submenu';

		return (
			<button
				type='button'
				role='menuitem'
				tabIndex={-1}
				key={isSubmenu ? `submenu-${item.label}` : `${item.command}-${item.filePath ?? ''}`}
				aria-haspopup={isSubmenu ? 'true' : undefined}
				aria-expanded={isSubmenu ? openNestedIndex === itemIndex : undefined}
				className={`menu-bar-entry ${isHighlighted ? 'menu-bar-entry-highlighted' : ''}`}
				onMouseDown={(event) => {
					event.preventDefault();
				}}
				onMouseEnter={() => {
					if(isNested) {
						setNestedHighlightedIndex(itemIndex);
					}
					else if(isSubmenu) {
						openNestedAt(itemIndex, -1);
					}
					else {
						setHighlightedIndex(itemIndex);
						closeNested();
					}
				}}
				onClick={() => {
					runItem(item, itemIndex);
				}}>
				<span className='menu-bar-entry-label'>{item.label}</span>
				{item.type === 'entry' && item.accelerator && <span className='menu-bar-entry-accelerator'>{item.accelerator}</span>}
				{isSubmenu && <span className='menu-bar-entry-arrow' aria-hidden='true'>›</span>}
			</button>
		);
	};

	return (
		<div className='menu-bar' role='menubar' aria-label={t('menu.bar')} ref={barRef}>
			{menus.map((menu, menuIndex) => {
				const isOpen = menu.id === openMenuId;

				return (
					<div className='menu-bar-menu' key={menu.id}>
						<button
							type='button'
							role='menuitem'
							aria-haspopup='true'
							aria-expanded={isOpen}
							className={`menu-bar-trigger ${isOpen ? 'menu-bar-trigger-open' : ''}`}
							ref={(element) => {
								triggerRefs.current[menu.id] = element;
							}}
							onMouseDown={(event) => {
								// Nothing here ever takes the focus with the pointer: the Edit entries act on the field the user was
								// typing in, and a focused menu button would be that field having lost its selection
								event.preventDefault();

								if(isOpen) {
									closeMenu();
								}
								else {
									openMenuAt(menuIndex, -1);
								}
							}}
							onMouseEnter={() => {
								// Once one submenu is open the others open by being pointed at, which is what every menu bar does
								if(openMenuId && !isOpen) {
									openMenuAt(menuIndex, -1);
								}
							}}
							onKeyDown={(event) => {
								if(event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
									event.preventDefault();
									openMenuAt(menuIndex, event.key === 'ArrowDown' ? findRowIndex(menu.items, -1, 1) : -1);
								}

								// While nothing is open the arrow keys walk the titles themselves, which is the other half of what
								// the keyboard does in a menu bar
								else if(event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
									event.preventDefault();
									focusTrigger(menuIndex + (event.key === 'ArrowRight' ? 1 : -1));
								}
							}}>
							{menu.label}
						</button>

						{isOpen && (
							<div className='menu-bar-dropdown' role='menu' aria-label={menu.label}>
								{menu.items.map((item, itemIndex) => {
									const row = renderRow(item, itemIndex, itemIndex === highlightedIndex, false);

									if(item.type !== 'submenu' || openNestedIndex !== itemIndex) {
										return row;
									}

									return (
										<div className='menu-bar-nested' key={`submenu-${item.label}`}>
											{row}
											<div className='menu-bar-dropdown menu-bar-nested-dropdown' role='menu' aria-label={item.label}>
												{item.items.map((nestedItem, nestedIndex) => {
													return renderRow(nestedItem, nestedIndex, nestedIndex === nestedHighlightedIndex, true);
												})}
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
};
