/**
 * The channel names both processes import, so that neither spells one out.
 * The "invoke" channels are requests the renderer makes and the main process answers; the "event" one is pushed the other way.
 */
export const SPICCIOLI_APP_MENU_IPC_CHANNELS = {
	getMenuBar: 'spiccioli:app-menu:get-menu-bar',
	runMenuCommand: 'spiccioli:app-menu:run-menu-command'
} as const;

export const SPICCIOLI_APP_MENU_IPC_EVENTS = {
	menuBarChanged: 'spiccioli:app-menu:menu-bar-changed'
} as const;
