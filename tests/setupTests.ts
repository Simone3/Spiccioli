// eslint-disable-next-line import/no-unassigned-import, import/no-internal-modules
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Testing Library decides whether fake timers are installed by probing for a global "jest" object, and without one it polls
// "findBy" queries on timers that Vitest has already frozen, so those queries hang until the test times out. Only the single
// helper Testing Library calls is exposed here: the test suite itself uses "vi" everywhere.
Object.defineProperty(globalThis, 'jest', {
	configurable: true,
	value: {
		advanceTimersByTime: (elapsedMillis: number): void => {
			vi.advanceTimersByTime(elapsedMillis);
		}
	}
});

let randomUUIDCounter = 0;

const makeRandomUUID = (): `${string}-${string}-${string}-${string}-${string}` => {
	randomUUIDCounter += 1;
	return `00000000-0000-4000-8000-${String(randomUUIDCounter).padStart(12, '0')}`;
};

const cryptoWithRandomUUID = Object.create(globalThis.crypto ?? null) as Crypto;
Object.defineProperty(cryptoWithRandomUUID, 'randomUUID', {
	configurable: true,
	writable: true,
	value: makeRandomUUID
});
Object.defineProperty(globalThis, 'crypto', {
	configurable: true,
	value: cryptoWithRandomUUID
});
