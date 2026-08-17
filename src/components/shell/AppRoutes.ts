import type { SpiccioliTranslationKey } from 'src/i18n/Translations';

/**
 * The eight screens, and the one screen that is reached from another rather than from the sidebar.
 *
 * The paths are written down once, here, so that a link, a route and a sidebar entry can never disagree. They are hash paths:
 * a packaged run loads the built page over "file://", where a path-based history has nothing to write into.
 *
 * **An opened file lands on Portfolio**, which is why it is the one at the root. Which screen was last looked at is not
 * remembered — not between files and not between sessions.
 */

export const APP_ROUTES = {
	portfolio: '/',
	accounts: '/accounts',
	transactions: '/transactions',
	bulkImport: '/transactions/import',
	categories: '/categories',
	investments: '/investments',
	salaries: '/salaries',
	checks: '/checks',
	settings: '/settings'
} as const;

export interface SidebarEntry {
	route: string;
	labelKey: SpiccioliTranslationKey;

	// Only the root route matches by prefix, so it is the only one that has to say it is the end of the path
	isRoot?: boolean;
}

// The order the sidebar lists them in, which is the order of the specification
export const SIDEBAR_ENTRIES: readonly SidebarEntry[] = [
	{ route: APP_ROUTES.portfolio, labelKey: 'screens.portfolio', isRoot: true },
	{ route: APP_ROUTES.accounts, labelKey: 'screens.accounts' },
	{ route: APP_ROUTES.transactions, labelKey: 'screens.transactions' },
	{ route: APP_ROUTES.categories, labelKey: 'screens.categories' },
	{ route: APP_ROUTES.investments, labelKey: 'screens.investments' },
	{ route: APP_ROUTES.salaries, labelKey: 'screens.salaries' },
	{ route: APP_ROUTES.checks, labelKey: 'screens.checks' },
	{ route: APP_ROUTES.settings, labelKey: 'screens.settings' }
];
