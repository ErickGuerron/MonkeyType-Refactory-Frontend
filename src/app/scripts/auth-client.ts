import {
	API_BASE_URL,
	ApiError,
	clearSession,
	getCurrentUser,
	postAuth,
	postJson,
	readSession,
	saveSession,
	validateResetToken
} from '../../infrastructure/api/auth-api';
import type { GenericApiPayload } from '../../infrastructure/api/auth-api';
import { showErrorAlert, showSuccessAlert, showToast } from '../../infrastructure/browser/alerts';
import { getCurrentUiLocale, t } from '../../core/i18n';

type FormMode = 'login' | 'register' | 'reset' | 'reset-confirm';

function redirectToLogin() {
	const next = `${window.location.pathname}${window.location.search}`;
	window.location.href = `/login?next=${encodeURIComponent(next)}`;
}

function redirectToPath(path: string) {
	window.location.href = path;
}

function getSafeNextPath() {
	const next = new URLSearchParams(window.location.search).get('next');
	return next && next.startsWith('/') ? next : '/home';
}

function getAuthenticatedHomePath() {
	return '/home';
}

function redirectAuthenticatedUser() {
	if (!readSession()) {
		return;
	}

	redirectToPath(getAuthenticatedHomePath());
}

function bindAuthenticatedUserRedirect() {
	redirectAuthenticatedUser();

	window.addEventListener('pageshow', () => {
		redirectAuthenticatedUser();
	});
}

function getResetToken() {
	return new URLSearchParams(window.location.search).get('token')?.trim() || '';
}

function setResetFormEnabled(form: HTMLFormElement, isEnabled: boolean) {
	const controls = form.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button[type="submit"]');
	controls.forEach((control) => {
		control.disabled = !isEnabled;
	});
	form.dataset.resetTokenValidated = isEnabled ? 'true' : 'false';
}

function setSubmittingState(form: HTMLFormElement, isSubmitting: boolean) {
	const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');

	if (isSubmitting) {
		submitButton?.setAttribute('disabled', 'true');
		return;
	}

	submitButton?.removeAttribute('disabled');
}

function setStatus(target: HTMLElement | null, message: string, tone: 'error' | 'success' | 'info') {
	if (!target) {
		return;
	}

	target.textContent = message;
	target.dataset.tone = tone;
	target.classList.add('is-visible');
}

function clearStatus(target: HTMLElement | null) {
	if (!target) {
		return;
	}

	target.textContent = '';
	target.classList.remove('is-visible');
	target.dataset.tone = 'info';
}

async function submitAuthForm(form: HTMLFormElement, mode: FormMode) {
	const formData = new FormData(form);
	setSubmittingState(form, true);

	try {
		if (mode === 'reset') {
			const email = String(formData.get('email') || '').trim();
			if (!email) {
				throw new ApiError(t('auth.validation.enterEmail'), 400);
			}

			await postJson<GenericApiPayload>('/auth/forgot-password', { email });
			form.reset();
			await showSuccessAlert(
				t('auth.reset.checkEmailTitle'),
				t('auth.reset.checkEmailBody')
			);
			return;
		}

		if (mode === 'reset-confirm') {
			const password = String(formData.get('password') || '');
			const confirmPassword = String(formData.get('confirmPassword') || '');
			const token = getResetToken();

			if (form.dataset.resetTokenValidated !== 'true') {
				throw new ApiError(t('auth.reset.invalidLinkBody'), 400);
			}

			if (!token) {
				throw new ApiError(t('auth.validation.missingToken'), 400);
			}

			if (!password) {
				throw new ApiError(t('auth.validation.enterNewPassword'), 400);
			}

			if (password !== confirmPassword) {
				throw new ApiError(t('auth.validation.passwordMismatch'), 400);
			}

			await postJson<GenericApiPayload>('/auth/reset-password', { token, password });
			form.reset();
			await showSuccessAlert(t('auth.reset.updatedTitle'), t('auth.reset.updatedBody'));
			redirectToPath('/login');
			return;
		}

		const email = String(formData.get('email') || '').trim();
		const password = String(formData.get('password') || '');

		if (!email || !password) {
			throw new ApiError(t('auth.validation.completeRequired'), 400);
		}

		const body: Record<string, string> = { email, password };

		if (mode === 'register') {
			const name = String(formData.get('name') || '').trim();
			const confirmPassword = String(formData.get('confirmPassword') || '');

			if (!name) {
				throw new ApiError(t('auth.validation.enterVisibleName'), 400);
			}

			if (password !== confirmPassword) {
				throw new ApiError(t('auth.validation.passwordMismatch'), 400);
			}

			body.name = name;
		}

		const payload = await postAuth(mode === 'login' ? '/auth/login' : '/auth/register', body);
		saveSession(payload);
		void showToast({
			title: mode === 'login' ? t('auth.toast.loginSuccessTitle') : t('auth.toast.registerSuccessTitle'),
			text: mode === 'login' ? t('auth.toast.loginSuccessBody') : t('auth.toast.registerSuccessBody'),
			icon: 'success',
			timer: 1400
		});
		window.setTimeout(() => {
			redirectToPath(getSafeNextPath());
		}, 900);
	} catch (error) {
		const message = error instanceof ApiError ? error.message : t('auth.unexpectedError');
		await showErrorAlert(message);
	} finally {
		setSubmittingState(form, false);
	}
}

async function guardResetConfirmForm(form: HTMLFormElement) {
	const token = getResetToken();
	setResetFormEnabled(form, false);

	if (!token) {
		await showToast({
			title: t('auth.reset.incompleteLinkTitle'),
			text: t('auth.reset.incompleteLinkBody'),
			icon: 'warning',
			timer: 3200
		});
		redirectToPath('/reset-password');
		return;
	}

	try {
		await validateResetToken(token);
		setResetFormEnabled(form, true);
	} catch (error) {
		const message = error instanceof ApiError ? error.message : t('auth.reset.invalidLinkBody');
		await showErrorAlert(message, t('auth.reset.invalidLinkTitle'));
		redirectToPath('/reset-password');
	}
}

export function initLandingPage() {
	bindAuthenticatedUserRedirect();
}

export function initPublicAuthPage() {
	bindAuthenticatedUserRedirect();
}

export function initAuthForms() {
	const forms = document.querySelectorAll<HTMLFormElement>('[data-auth-form]');

	forms.forEach((form) => {
		if (form.dataset.bound === 'true') {
			return;
		}

		form.dataset.bound = 'true';
		const mode = (form.dataset.mode || 'login') as FormMode;

		if (mode === 'reset-confirm') {
			void guardResetConfirmForm(form);
		}

		form.addEventListener('submit', (event) => {
			event.preventDefault();
			void submitAuthForm(form, mode);
		});
	});
}

function formatTimestamp(value: string) {
	return new Intl.DateTimeFormat(getCurrentUiLocale() === 'es' ? 'es-EC' : 'en-US', {
		dateStyle: 'medium',
		timeStyle: 'short'
	}).format(new Date(value));
}

export function initAppShell() {
	const session = readSession();

	if (!session) {
		redirectToLogin();
		return;
	}

	const shell = document.querySelector<HTMLElement>('[data-app-shell]');
	if (!shell || shell.dataset.bound === 'true') {
		return;
	}

	shell.dataset.bound = 'true';
	const status = shell.querySelector<HTMLElement>('[data-app-status]');
	const userName = shell.querySelector<HTMLElement>('[data-user-name]');
	const userEmail = shell.querySelector<HTMLElement>('[data-user-email]');
	const userStored = shell.querySelector<HTMLElement>('[data-user-stored]');
	const tokenValue = shell.querySelector<HTMLElement>('[data-token-value]');
	const docsLink = document.querySelector<HTMLAnchorElement>('[data-api-link]');
	const logoutButton = shell.querySelector<HTMLButtonElement>('[data-action="logout"]');

	if (docsLink) {
		docsLink.href = `${API_BASE_URL}/docs`;
	}

	if (userName) userName.textContent = session.user.name;
	if (userEmail) userEmail.textContent = session.user.email;
	if (userStored) userStored.textContent = t('auth.session.storedToken', { timestamp: formatTimestamp(session.storedAt) });
	if (tokenValue) tokenValue.textContent = `${session.tokenType} ${session.token.slice(0, 28)}…`;
	setStatus(status, t('auth.session.validating'), 'info');

	void getCurrentUser(session.token, session.tokenType)
		.then((payload) => {
			if (userName) userName.textContent = payload.user.name;
			if (userEmail) userEmail.textContent = payload.user.email;
			setStatus(status, t('auth.session.validated'), 'success');
		})
		.catch((error) => {
			clearSession();
			setStatus(status, error instanceof Error ? t('auth.session.redirectingLogin', { message: error.message }) : t('auth.session.expiredRedirecting'), 'error');
			window.setTimeout(() => {
				redirectToLogin();
			}, 350);
		});

	logoutButton?.addEventListener('click', () => {
		clearSession();
		redirectToLogin();
	});
}

export function initSettingsPage() {
	const session = readSession();

	if (!session) {
		redirectToLogin();
		return;
	}

	const page = document.querySelector<HTMLElement>('[data-settings-page]');
	if (!page || page.dataset.bound === 'true') {
		return;
	}

	page.dataset.bound = 'true';
	const status = page.querySelector<HTMLElement>('[data-settings-status]');
	const userName = page.querySelector<HTMLElement>('[data-settings-user-name]');
	const userEmail = page.querySelector<HTMLElement>('[data-settings-user-email]');
	const logoutButton = page.querySelector<HTMLButtonElement>('[data-action="logout"]');

	if (userName) userName.textContent = session.user.name;
	if (userEmail) userEmail.textContent = session.user.email;
	setStatus(status, 'Preferencias listas para personalizar en próximas iteraciones.', 'info');

	void getCurrentUser(session.token, session.tokenType)
		.then((payload) => {
			if (userName) userName.textContent = payload.user.name;
			if (userEmail) userEmail.textContent = payload.user.email;
		})
		.catch(() => {
			clearSession();
			redirectToLogin();
		});

	logoutButton?.addEventListener('click', () => {
		clearSession();
		redirectToLogin();
	});
}
