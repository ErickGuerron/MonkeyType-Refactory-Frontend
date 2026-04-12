import { API_BASE_URL, ApiError, type SessionPayload } from './auth-api';

export interface UserPreferences {
	theme: 'system' | 'dark' | 'light';
	language: string;
	defaultMode: 'time' | 'words' | 'quote' | 'zen' | 'custom';
	timeDuration: 30 | 60 | 120;
	showLiveWpm: boolean;
	punctuationEnabled: boolean;
	numbersEnabled: boolean;
	soundEnabled: boolean;
}

export interface TypingQuote {
	id: string;
	text: string;
	source: string | null;
	language: string;
	length: 'short' | 'medium' | 'long';
	hasNumbers: boolean;
	tags: string[];
	createdAt: string;
	updatedAt: string;
}

export interface TypingResult {
	id: string;
	userId: string;
	wpm: number;
	rawWpm: number;
	accuracy: number;
	mode: string;
	duration: number;
	language: string;
	quoteId: string | null;
	quoteSource: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface CreateTypingResultInput {
	wpm: number;
	rawWpm: number;
	accuracy: number;
	mode: UserPreferences['defaultMode'];
	duration: number;
	language: string;
	quoteId?: string | null;
	quoteSource?: string | null;
}

interface ApiResponse<T> {
	success: boolean;
	message: string;
	data?: T;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
	theme: 'system',
	language: 'english',
	defaultMode: 'time',
	timeDuration: 30,
	showLiveWpm: true,
	punctuationEnabled: false,
	numbersEnabled: false,
	soundEnabled: false
};

const PREFERENCES_STORAGE_KEY = 'monkeytype.user-preferences';

function mergeWithDefaultPreferences(preferences: Partial<UserPreferences> | undefined) {
	return {
		...DEFAULT_PREFERENCES,
		...preferences
	};
}

export function readCachedPreferences() {
	if (typeof window === 'undefined') {
		return null;
	}

	try {
		const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
		if (!raw) {
			return null;
		}

		return mergeWithDefaultPreferences(JSON.parse(raw) as Partial<UserPreferences>);
	} catch {
		return null;
	}
}

export function writeCachedPreferences(preferences: UserPreferences) {
	if (typeof window === 'undefined') {
		return;
	}

	window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
}

function createAuthHeaders(session: SessionPayload, hasBody = false) {
	return {
		Authorization: `${session.tokenType} ${session.token}`,
		...(hasBody ? { 'Content-Type': 'application/json' } : {})
	};
}

async function parseResponse<T>(response: Response) {
	const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

	if (!response.ok) {
		throw new ApiError(payload?.message || 'No se pudo completar la operación.', response.status);
	}

	if (!payload?.data) {
		throw new ApiError('La API respondió sin datos utilizables.', response.status);
	}

	return payload.data;
}

function createQuery(params: Record<string, string | boolean | undefined>) {
	const query = new URLSearchParams();

	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined) {
			query.set(key, String(value));
		}
	});

	const serialized = query.toString();
	return serialized ? `?${serialized}` : '';
}

export async function getRandomQuote(filters: { language?: string; length?: 'short' | 'medium' | 'long'; hasNumbers?: boolean } = {}) {
	const response = await fetch(`${API_BASE_URL}/quotes/random${createQuery(filters)}`);
	const data = await parseResponse<{ quote: TypingQuote }>(response);
	return data.quote;
}

export async function getMyResults(session: SessionPayload) {
	const response = await fetch(`${API_BASE_URL}/results/me`, {
		headers: createAuthHeaders(session)
	});
	const data = await parseResponse<{ results: TypingResult[] }>(response);
	return data.results;
}

export async function createResult(session: SessionPayload, payload: CreateTypingResultInput) {
	const response = await fetch(`${API_BASE_URL}/results`, {
		method: 'POST',
		headers: createAuthHeaders(session, true),
		body: JSON.stringify(payload)
	});
	const data = await parseResponse<{ result: TypingResult }>(response);
	return data.result;
}

export async function getMyPreferences(session: SessionPayload) {
	const response = await fetch(`${API_BASE_URL}/users/me/preferences`, {
		headers: createAuthHeaders(session)
	});
	const data = await parseResponse<{ preferences: UserPreferences }>(response);
	const preferences = mergeWithDefaultPreferences(data.preferences);
	writeCachedPreferences(preferences);
	return preferences;
}

export async function updateMyPreferences(session: SessionPayload, payload: Partial<UserPreferences>) {
	const response = await fetch(`${API_BASE_URL}/users/me/preferences`, {
		method: 'PATCH',
		headers: createAuthHeaders(session, true),
		body: JSON.stringify(payload)
	});
	const data = await parseResponse<{ preferences: UserPreferences }>(response);
	const preferences = mergeWithDefaultPreferences(data.preferences);
	writeCachedPreferences(preferences);
	return preferences;
}
