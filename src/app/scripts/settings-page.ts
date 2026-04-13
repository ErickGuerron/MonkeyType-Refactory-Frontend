import { ApiError } from '../../infrastructure/api/auth-api';
import { showErrorAlert, showToast } from '../../infrastructure/browser/alerts';
import { getCurrentUiLocale } from '../../core/i18n';
import {
	DEFAULT_PREFERENCES,
	getMyPreferences,
	readCachedPreferences,
	updateMyPreferences,
	type UserPreferences
} from '../../infrastructure/api/typing-api';
import { t } from '../../core/i18n';
import {
	applyThemePreference,
	bindLogout,
	clearStatus,
	handleAuthFailure,
	requireSession,
	setStatus,
	syncCurrentUser
} from '../../core/session/private-session';

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
	const modeLabel =
		preferences.defaultMode === 'quote'
			? t('home.mode.quoteDisplay')
			: preferences.defaultMode === 'zen'
				? t('home.mode.zenDisplay')
				: preferences.defaultMode === 'custom'
					? t('home.mode.customDisplay')
					: preferences.defaultMode;
	const modeSummary =
		preferences.defaultMode === 'time'
			? t('settings.summary.mode.time', { duration: preferences.timeDuration })
			: preferences.defaultMode === 'words'
				? t('settings.summary.mode.words')
				: modeLabel;

	target.textContent = t('settings.summary', {
		theme: t(`settings.theme.${preferences.theme}`),
		language: t(`settings.language.${preferences.language}`),
		mode: modeSummary,
		liveWpm: preferences.showLiveWpm ? t('common.on') : t('common.off'),
		punctuation: preferences.punctuationEnabled ? t('common.on') : t('common.off'),
		numbers: preferences.numbersEnabled ? t('common.on') : t('common.off'),
		sound: preferences.soundEnabled ? t('common.on') : t('common.off')
	});
}

function initHeroTypingEffect() {
	const heroTyping = document.querySelector<HTMLElement>('[data-settings-hero-typing]');
	const textNode = document.querySelector<HTMLElement>('[data-settings-hero-typing-text]');

	if (!heroTyping || !textNode || heroTyping.dataset.bound === 'true') {
		return;
	}

	heroTyping.dataset.bound = 'true';
	const typeDelay = 110;
	const eraseDelay = 60;
	const holdAfterType = 1400;
	const holdAfterErase = 320;
	let activeRun = 0;
	let charIndex = 0;
	let isDeleting = false;

	const getWordForLocale = () => (getCurrentUiLocale() === 'es' ? 'CONFIGURACIONES' : 'SETTINGS');

	const scheduleNext = (callback: () => void, delay: number, runId: number) => {
		window.setTimeout(() => {
			if (runId !== activeRun) {
				return;
			}

			callback();
		}, delay);
	};

	const startAnimation = () => {
		activeRun += 1;
		const runId = activeRun;
		charIndex = 0;
		isDeleting = false;
		textNode.textContent = '';

		const tick = () => {
			const word = getWordForLocale();

			if (!isDeleting) {
				charIndex = Math.min(charIndex + 1, word.length);
				textNode.textContent = word.slice(0, charIndex);

				if (charIndex === word.length) {
					scheduleNext(() => {
						isDeleting = true;
						tick();
					}, holdAfterType, runId);
					return;
				}

				scheduleNext(tick, typeDelay, runId);
				return;
			}

			charIndex = Math.max(charIndex - 1, 0);
			textNode.textContent = word.slice(0, charIndex);

			if (charIndex === 0) {
				isDeleting = false;
				scheduleNext(tick, holdAfterErase, runId);
				return;
			}

			scheduleNext(tick, eraseDelay, runId);
		};

		tick();
	};

	startAnimation();
	window.addEventListener('monkeytype:localechange', startAnimation);
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
	initHeroTypingEffect();

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
				title: t('settings.toast.noChangesTitle'),
				text: t('settings.toast.noChangesText'),
				icon: 'info',
				timer: 1800
			});
			return;
		}

		saveButton.disabled = true;
		setStatus(status, t('settings.status.saving'), 'info');

		try {
			const updatedPreferences = await updateMyPreferences(session, dirtyPayload);
			initialPreferences = updatedPreferences;
			applyPreferencesToForm(form, updatedPreferences);
			applyThemePreference(updatedPreferences.theme);
			syncDirtyState();
			setStatus(status, t('settings.status.updated'), 'success');
			void showToast({
				title: t('settings.toast.savedTitle'),
				text: t('settings.toast.savedText'),
				icon: 'success',
				timer: 2200
			});
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) {
				handleAuthFailure();
				return;
			}

			saveButton.disabled = false;
			setStatus(status, error instanceof Error ? error.message : t('settings.error.save'), 'error');
			await showErrorAlert(error instanceof Error ? error.message : t('settings.error.save'));
		}
	});

	loadingStatusTimer = window.setTimeout(() => {
		setStatus(status, t('settings.status.loading'), 'info');
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

			setStatus(status, error instanceof Error ? error.message : t('settings.error.load'), 'error');
			await showErrorAlert(error instanceof Error ? error.message : t('settings.error.load'));
		});

	window.addEventListener('monkeytype:localechange', () => {
		syncDirtyState();
	});
}
