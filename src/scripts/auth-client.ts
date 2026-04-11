import {
	API_BASE_URL,
	ApiError,
	clearSession,
	getCurrentUser,
	postAuth,
	readSession,
	saveSession
} from '../lib/auth-api';

type FormMode = 'login' | 'register' | 'reset';

function redirectToLogin() {
	const next = `${window.location.pathname}${window.location.search}`;
	window.location.href = `/login?next=${encodeURIComponent(next)}`;
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
	const status = form.parentElement?.querySelector<HTMLElement>('[data-auth-status]') || null;
	const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
	const formData = new FormData(form);

	clearStatus(status);
	submitButton?.setAttribute('disabled', 'true');

	try {
		if (mode === 'reset') {
			const email = String(formData.get('email') || '').trim();
			if (!email) {
				throw new ApiError('Ingresá tu email para dejar preparado el flujo de recuperación.', 400);
			}

			setStatus(
				status,
				`Todavía no existe un endpoint de reset en el backend. Dejé la UI lista para conectarlo cuando esté disponible. API actual: ${API_BASE_URL}`,
				'info'
			);
			return;
		}

		const email = String(formData.get('email') || '').trim();
		const password = String(formData.get('password') || '');

		if (!email || !password) {
			throw new ApiError('Completá los campos requeridos.', 400);
		}

		const body: Record<string, string> = { email, password };

		if (mode === 'register') {
			const name = String(formData.get('name') || '').trim();
			const confirmPassword = String(formData.get('confirmPassword') || '');

			if (!name) {
				throw new ApiError('Ingresá un nombre visible para tu cuenta.', 400);
			}

			if (password !== confirmPassword) {
				throw new ApiError('Las contraseñas no coinciden.', 400);
			}

			body.name = name;
		}

		const payload = await postAuth(mode === 'login' ? '/auth/login' : '/auth/register', body);
		saveSession(payload);
		setStatus(status, mode === 'login' ? 'Login exitoso. Redirigiendo a /home...' : 'Cuenta creada. Redirigiendo a /home...', 'success');
		window.setTimeout(() => {
			const next = new URLSearchParams(window.location.search).get('next');
			window.location.href = next && next.startsWith('/') ? next : '/home';
		}, 450);
	} catch (error) {
		const message = error instanceof ApiError ? error.message : 'Ocurrió un error inesperado.';
		setStatus(status, message, 'error');
	} finally {
		submitButton?.removeAttribute('disabled');
	}
}

export function initAuthForms() {
	const forms = document.querySelectorAll<HTMLFormElement>('[data-auth-form]');

	forms.forEach((form) => {
		if (form.dataset.bound === 'true') {
			return;
		}

		form.dataset.bound = 'true';
		const mode = (form.dataset.mode || 'login') as FormMode;

		form.addEventListener('submit', (event) => {
			event.preventDefault();
			void submitAuthForm(form, mode);
		});
	});
}

function formatTimestamp(value: string) {
	return new Intl.DateTimeFormat('es-EC', {
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
	if (userStored) userStored.textContent = `Token guardado localmente • ${formatTimestamp(session.storedAt)}`;
	if (tokenValue) tokenValue.textContent = `${session.tokenType} ${session.token.slice(0, 28)}…`;
	setStatus(status, 'Validando sesión contra /api/auth/me...', 'info');

	void getCurrentUser(session.token, session.tokenType)
		.then((payload) => {
			if (userName) userName.textContent = payload.user.name;
			if (userEmail) userEmail.textContent = payload.user.email;
			setStatus(status, 'Sesión validada correctamente contra el backend.', 'success');
		})
		.catch((error) => {
			clearSession();
			setStatus(status, error instanceof Error ? `${error.message} Redirigiendo a login...` : 'La sesión expiró. Redirigiendo a login...', 'error');
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
