import { API_BASE_URL, ApiError, type SessionPayload } from './auth-api';

export interface UserPreferences {
	theme: 'system' | 'dark' | 'light';
	language: string;
	defaultMode: 'time' | 'words' | 'quote' | 'zen' | 'custom';
	timeDuration: 30 | 60 | 120;
	showLiveWpm: boolean;
	soundEnabled: boolean;
}

export interface TypingQuote {
	id: string;
	text: string;
	source: string | null;
	language: string;
	length: 'short' | 'medium' | 'long';
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
	soundEnabled: false
};

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

function createQuery(params: Record<string, string | undefined>) {
	const query = new URLSearchParams();

	Object.entries(params).forEach(([key, value]) => {
		if (value) {
			query.set(key, value);
		}
	});

	const serialized = query.toString();
	return serialized ? `?${serialized}` : '';
}

export async function getRandomQuote(filters: { language?: string; length?: 'short' | 'medium' | 'long' } = {}) {
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
	return {
		...DEFAULT_PREFERENCES,
		...data.preferences
	};
}

export async function updateMyPreferences(session: SessionPayload, payload: Partial<UserPreferences>) {
	const response = await fetch(`${API_BASE_URL}/users/me/preferences`, {
		method: 'PATCH',
		headers: createAuthHeaders(session, true),
		body: JSON.stringify(payload)
	});
	const data = await parseResponse<{ preferences: UserPreferences }>(response);
	return {
		...DEFAULT_PREFERENCES,
		...data.preferences
	};
}
