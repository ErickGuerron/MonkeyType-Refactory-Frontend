import { clearSession, getCurrentUser, readSession, type PublicUser, type SessionPayload } from '../../infrastructure/api/auth-api';
import { getCurrentUiLocale } from '../i18n';

type StatusTone = 'error' | 'success' | 'info';
type ThemePreference = 'system' | 'dark' | 'light';

let systemThemeListenerBound = false;

const THEME_PREFERENCE_STORAGE_KEY = 'monkeytype.theme-preference';

export function redirectToLogin() {
	const next = `${window.location.pathname}${window.location.search}`;
	window.location.href = `/login?next=${encodeURIComponent(next)}`;
}

export function redirectToPath(path: string) {
	window.location.href = path;
}

export function requireSession() {
	const session = readSession();

	if (!session) {
		redirectToLogin();
		return null;
	}

	return session;
}

export function handleAuthFailure() {
	clearSession();
	redirectToLogin();
}

export function bindLogout(button: HTMLButtonElement | null, path = '/login') {
	button?.addEventListener('click', () => {
		clearSession();
		redirectToPath(path);
	});
}

export async function syncCurrentUser(
	session: SessionPayload,
	onSuccess: (user: PublicUser) => void,
	onError?: (error: unknown) => void
) {
	try {
		const payload = await getCurrentUser(session.token, session.tokenType);
		onSuccess(payload.user);
		return payload.user;
	} catch (error) {
		onError?.(error);
		handleAuthFailure();
		return null;
	}
}

export function setStatus(target: HTMLElement | null, message: string, tone: StatusTone) {
	if (!target) {
		return;
	}

	target.textContent = message;
	target.dataset.tone = tone;
	target.classList.add('is-visible');
}

export function clearStatus(target: HTMLElement | null) {
	if (!target) {
		return;
	}

	target.textContent = '';
	target.dataset.tone = 'info';
	target.classList.remove('is-visible');
}

export function formatDateTime(value: string, locale = getCurrentUiLocale() === 'es' ? 'es-EC' : 'en-US') {
	return new Intl.DateTimeFormat(locale, {
		dateStyle: 'medium',
		timeStyle: 'short'
	}).format(new Date(value));
}

function resolveSystemTheme() {
	return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function persistThemePreference(preference: ThemePreference) {
	window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference);
}

function updateThemeAttribute(preference: ThemePreference) {
	const resolvedTheme = preference === 'system' ? resolveSystemTheme() : preference;
	document.documentElement.dataset.userTheme = resolvedTheme;
	document.documentElement.dataset.themePreference = preference;
	document.body.dataset.userTheme = resolvedTheme;
	document.body.dataset.themePreference = preference;
	persistThemePreference(preference);
}

export function applyThemePreference(preference: string) {
	const normalizedPreference = (preference || 'system') as ThemePreference;
	updateThemeAttribute(normalizedPreference);

	if (systemThemeListenerBound) {
		return;
	}

	const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
	mediaQuery.addEventListener('change', () => {
		const currentPreference = (document.body.dataset.themePreference || 'system') as ThemePreference;
		if (currentPreference === 'system') {
			updateThemeAttribute(currentPreference);
		}
	});

	systemThemeListenerBound = true;
}
