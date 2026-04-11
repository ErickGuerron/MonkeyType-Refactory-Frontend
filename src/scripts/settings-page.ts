import { ApiError } from '../lib/auth-api';
import { showErrorAlert, showToast } from '../lib/alerts';
import {
	DEFAULT_PREFERENCES,
	getMyPreferences,
	updateMyPreferences,
	type UserPreferences
} from '../lib/typing-api';
import {
	applyThemePreference,
	bindLogout,
	clearStatus,
	handleAuthFailure,
	requireSession,
	setStatus,
	syncCurrentUser
} from '../lib/private-session';

function serializePreferences(form: HTMLFormElement): UserPreferences {
	const formData = new FormData(form);
	return {
		theme: String(formData.get('theme') || DEFAULT_PREFERENCES.theme) as UserPreferences['theme'],
		language: String(formData.get('language') || DEFAULT_PREFERENCES.language),
		defaultMode: String(formData.get('defaultMode') || DEFAULT_PREFERENCES.defaultMode) as UserPreferences['defaultMode'],
		showLiveWpm: formData.get('showLiveWpm') === 'on',
		soundEnabled: formData.get('soundEnabled') === 'on'
	};
}

function applyPreferencesToForm(form: HTMLFormElement, preferences: UserPreferences) {
	const entries = Object.entries(preferences) as Array<[keyof UserPreferences, UserPreferences[keyof UserPreferences]]>;

	entries.forEach(([key, value]) => {
		const field = form.elements.namedItem(key);
		if (!field) {
			return;
		}

		if (field instanceof HTMLInputElement && field.type === 'checkbox') {
			field.checked = Boolean(value);
			return;
		}

		if (field instanceof HTMLSelectElement) {
			field.value = String(value);
		}
	});
}

function getDirtyPayload(initial: UserPreferences, current: UserPreferences) {
	return (Object.keys(current) as Array<keyof UserPreferences>).reduce<Partial<UserPreferences>>((accumulator, key) => {
		if (initial[key] !== current[key]) {
			accumulator[key] = current[key];
		}

		return accumulator;
	}, {});
}

function describePreferences(target: HTMLElement, preferences: UserPreferences) {
	target.textContent = `Theme ${preferences.theme} • ${preferences.language} • ${preferences.defaultMode} • live WPM ${preferences.showLiveWpm ? 'on' : 'off'} • sound ${preferences.soundEnabled ? 'on' : 'off'}`;
}

export function initSettingsPage() {
	const session = requireSession();
	if (!session) {
		return;
	}

	const page = document.querySelector<HTMLElement>('[data-settings-page]');
	if (!page || page.dataset.bound === 'true') {
		return;
	}

	page.dataset.bound = 'true';

	const form = page.querySelector<HTMLFormElement>('[data-preferences-form]');
	const status = page.querySelector<HTMLElement>('[data-settings-status]');
	const userName = page.querySelector<HTMLElement>('[data-settings-user-name]');
	const userEmail = page.querySelector<HTMLElement>('[data-settings-user-email]');
	const summary = page.querySelector<HTMLElement>('[data-settings-summary]');
	const saveButton = page.querySelector<HTMLButtonElement>('[data-action="save-preferences"]');
	const resetButton = page.querySelector<HTMLButtonElement>('[data-action="reset-form"]');
	const logoutButtons = page.querySelectorAll<HTMLButtonElement>('[data-action="logout"]');

	if (!form || !status || !summary || !saveButton || !resetButton) {
		return;
	}

	let initialPreferences = { ...DEFAULT_PREFERENCES };

	const syncDirtyState = () => {
		const currentPreferences = serializePreferences(form);
		const dirtyPayload = getDirtyPayload(initialPreferences, currentPreferences);
		saveButton.disabled = Object.keys(dirtyPayload).length === 0;
		describePreferences(summary, currentPreferences);
	};

	logoutButtons.forEach((button) => bindLogout(button));
	if (userName) userName.textContent = session.user.name;
	if (userEmail) userEmail.textContent = session.user.email;

	void syncCurrentUser(session, (user) => {
		if (userName) userName.textContent = user.name;
		if (userEmail) userEmail.textContent = user.email;
	});

	form.addEventListener('input', () => {
		clearStatus(status);
		syncDirtyState();
		applyThemePreference(serializePreferences(form).theme);
	});

	resetButton.addEventListener('click', () => {
		applyPreferencesToForm(form, initialPreferences);
		applyThemePreference(initialPreferences.theme);
		clearStatus(status);
		syncDirtyState();
	});

	form.addEventListener('submit', async (event) => {
		event.preventDefault();

		const currentPreferences = serializePreferences(form);
		const dirtyPayload = getDirtyPayload(initialPreferences, currentPreferences);

		if (Object.keys(dirtyPayload).length === 0) {
			void showToast({
				title: 'Sin cambios',
				text: 'No hay preferencias nuevas para guardar.',
				icon: 'info',
				timer: 1800
			});
			return;
		}

		saveButton.disabled = true;
		setStatus(status, 'Guardando preferencias reales en el backend...', 'info');

		try {
			const updatedPreferences = await updateMyPreferences(session, dirtyPayload);
			initialPreferences = updatedPreferences;
			applyPreferencesToForm(form, updatedPreferences);
			applyThemePreference(updatedPreferences.theme);
			syncDirtyState();
			setStatus(status, 'Preferencias actualizadas correctamente.', 'success');
			void showToast({
				title: 'Preferencias guardadas',
				text: 'Tu configuración ya quedó persistida en el backend.',
				icon: 'success',
				timer: 2200
			});
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) {
				handleAuthFailure();
				return;
			}

			saveButton.disabled = false;
			setStatus(status, error instanceof Error ? error.message : 'No se pudieron guardar las preferencias.', 'error');
			await showErrorAlert(error instanceof Error ? error.message : 'No se pudieron guardar las preferencias.');
		}
	});

	setStatus(status, 'Cargando preferencias...', 'info');
	void getMyPreferences(session)
		.then((preferences) => {
			initialPreferences = preferences;
			applyPreferencesToForm(form, preferences);
			applyThemePreference(preferences.theme);
			clearStatus(status);
			syncDirtyState();
		})
		.catch(async (error) => {
			if (error instanceof ApiError && error.status === 401) {
				handleAuthFailure();
				return;
			}

			setStatus(status, error instanceof Error ? error.message : 'No se pudieron cargar las preferencias.', 'error');
			await showErrorAlert(error instanceof Error ? error.message : 'No se pudieron cargar las preferencias.');
		});
}
