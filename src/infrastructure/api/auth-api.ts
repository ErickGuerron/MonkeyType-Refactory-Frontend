import { t } from '../../core/i18n';

export const API_BASE_URL = (import.meta.env.PUBLIC_API_BASE_URL || 'http://localhost:3000/api').replace(/\/$/, '');
export const AUTH_STORAGE_KEY = 'monkeytype.auth.session';

export interface PublicUser {
	id: string;
	name: string;
	email: string;
}

export interface AuthPayload {
	user: PublicUser;
	token: string;
	tokenType: string;
	expiresIn: string;
}

export interface SessionPayload extends AuthPayload {
	storedAt: string;
}

export interface GenericApiPayload {
	accepted?: boolean;
	updated?: boolean;
	valid?: boolean;
}

interface ApiResponse<T> {
	success: boolean;
	message: string;
	code?: string;
	data?: T;
}

function translateApiError(message: string, code?: string) {
	if (!code) {
		return message;
	}

	const translated = t(`apiErrors.${code}`);
	return translated === `apiErrors.${code}` ? message : translated;
}

export class ApiError extends Error {
	status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
	}
}

async function parseResponse<T>(response: Response): Promise<T> {
	const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

	if (!response.ok) {
		throw new ApiError(translateApiError(payload?.message || 'No se pudo completar la operación.', payload?.code), response.status);
	}

	if (!payload?.data) {
		throw new ApiError('La API respondió sin datos utilizables.', response.status);
	}

	return payload.data;
}

export async function postJson<T>(path: string, body: Record<string, unknown>) {
	const response = await fetch(`${API_BASE_URL}${path}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	});

	return parseResponse<T>(response);

}

export async function getJson<T>(path: string) {
	const response = await fetch(`${API_BASE_URL}${path}`);

	return parseResponse<T>(response);
}

export async function postAuth(path: string, body: Record<string, unknown>) {
	return postJson<AuthPayload>(path, body);
}

export async function validateResetToken(token: string) {
	const query = new URLSearchParams({ token });
	return getJson<GenericApiPayload>(`/auth/reset-password/validate?${query.toString()}`);
}

export async function getCurrentUser(token: string, tokenType = 'Bearer') {
	const response = await fetch(`${API_BASE_URL}/auth/me`, {
		headers: {
			Authorization: `${tokenType} ${token}`
		}
	});

	return parseResponse<{ user: PublicUser }>(response);
}

export function saveSession(payload: AuthPayload) {
	const session: SessionPayload = {
		...payload,
		storedAt: new Date().toISOString()
	};

	localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
	return session;
}

export function readSession() {
	const raw = localStorage.getItem(AUTH_STORAGE_KEY);

	if (!raw) {
		return null;
	}

	try {
		return JSON.parse(raw) as SessionPayload;
	} catch {
		localStorage.removeItem(AUTH_STORAGE_KEY);
		return null;
	}
}

export function clearSession() {
	localStorage.removeItem(AUTH_STORAGE_KEY);
}
