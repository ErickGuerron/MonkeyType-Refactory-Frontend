import { ApiError } from '../lib/auth-api';
import { showErrorAlert, showToast } from '../lib/alerts';
import {
	DEFAULT_PREFERENCES,
	getMyPreferences,
	readCachedPreferences,
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
		timeDuration: Number(formData.get('timeDuration') || DEFAULT_PREFERENCES.timeDuration) as UserPreferences['timeDuration'],
		showLiveWpm: formData.get('showLiveWpm') === 'on',
		punctuationEnabled: formData.get('punctuationEnabled') === 'on',
		numbersEnabled: formData.get('numbersEnabled') === 'on',
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
	const modeSummary =
		preferences.defaultMode === 'time'
			? `${preferences.defaultMode} ${preferences.timeDuration}s`
			: preferences.defaultMode === 'words'
				? 'words 50/100/150 on home'
				: preferences.defaultMode;

	target.textContent = `Theme ${preferences.theme} • ${preferences.language} • ${modeSummary} • live WPM ${preferences.showLiveWpm ? 'on' : 'off'} • punctuation ${preferences.punctuationEnabled ? 'on' : 'off'} • numbers ${preferences.numbersEnabled ? 'on' : 'off'} • sound ${preferences.soundEnabled ? 'on' : 'off'}`;
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
	const cachedPreferences = readCachedPreferences();
	let loadingStatusTimer = 0 as number | undefined;

	const clearLoadingTimer = () => {
		if (loadingStatusTimer !== undefined) {
			window.clearTimeout(loadingStatusTimer);
			loadingStatusTimer = undefined;
		}
	};

	const syncDirtyState = () => {
		const currentPreferences = serializePreferences(form);
		const dirtyPayload = getDirtyPayload(initialPreferences, currentPreferences);
		saveButton.disabled = Object.keys(dirtyPayload).length === 0;
		describePreferences(summary, currentPreferences);
	};

	logoutButtons.forEach((button) => bindLogout(button));
	if (userName) userName.textContent = session.user.name;
	if (userEmail) userEmail.textContent = session.user.email;

	if (cachedPreferences) {
		initialPreferences = cachedPreferences;
		applyPreferencesToForm(form, cachedPreferences);
		applyThemePreference(cachedPreferences.theme);
		clearStatus(status);
		syncDirtyState();
	}

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

	loadingStatusTimer = window.setTimeout(() => {
		setStatus(status, 'Cargando preferencias...', 'info');
	}, 180);
	void getMyPreferences(session)
		.then((preferences) => {
			clearLoadingTimer();
			initialPreferences = preferences;
			applyPreferencesToForm(form, preferences);
			applyThemePreference(preferences.theme);
			clearStatus(status);
			syncDirtyState();
		})
		.catch(async (error) => {
			clearLoadingTimer();
			if (error instanceof ApiError && error.status === 401) {
				handleAuthFailure();
				return;
			}

			setStatus(status, error instanceof Error ? error.message : 'No se pudieron cargar las preferencias.', 'error');
			await showErrorAlert(error instanceof Error ? error.message : 'No se pudieron cargar las preferencias.');
		});
}
