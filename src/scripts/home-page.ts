import { ApiError } from '../lib/auth-api';
import { showErrorAlert, showToast } from '../lib/alerts';
import {
	DEFAULT_PREFERENCES,
	createResult,
	getMyPreferences,
	getMyResults,
	getRandomQuote,
	updateMyPreferences,
	type TypingQuote,
	type TypingResult,
	type UserPreferences
} from '../lib/typing-api';
import {
	applyThemePreference,
	bindLogout,
	clearStatus,
	formatDateTime,
	handleAuthFailure,
	requireSession,
	setStatus,
	syncCurrentUser
} from '../lib/private-session';

const TIME_MODE_DURATION_SECONDS = 30;

interface TypingMetrics {
	wpm: number;
	rawWpm: number;
	accuracy: number;
	durationInSeconds: number;
	correctCharacters: number;
	typedCharacters: number;
	mistakes: number;
}

function roundMetric(value: number) {
	return Math.round(value * 100) / 100;
}

function escapeHtml(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function getQuoteLengthForMode(mode: UserPreferences['defaultMode']): 'short' | 'medium' | 'long' {
	if (mode === 'time') {
		return 'medium';
	}

	if (mode === 'quote') {
		return 'long';
	}

	return 'short';
}

async function getQuoteWithFallback(preferences: UserPreferences) {
	const preferredLength = getQuoteLengthForMode(preferences.defaultMode);
	const attempts: Array<{ language?: string; length?: 'short' | 'medium' | 'long' }> = [
		{ language: preferences.language, length: preferredLength },
		{ language: preferences.language },
		{ language: 'english', length: preferredLength },
		{}
	];

	let lastError: unknown = null;

	for (const filters of attempts) {
		try {
			return await getRandomQuote(filters);
		} catch (error) {
			lastError = error;
			if (!(error instanceof ApiError) || error.status !== 404) {
				throw error;
			}
		}
	}

	throw lastError instanceof Error ? lastError : new Error('No se pudo obtener una quote.');
}

function getModeLabel(mode: UserPreferences['defaultMode']) {
	const labels: Record<UserPreferences['defaultMode'], string> = {
		time: 'Time 30s',
		words: 'Words',
		quote: 'Quote',
		zen: 'Zen',
		custom: 'Custom'
	};

	return labels[mode] || mode;
}

function getLanguageLabel(language: string) {
	const normalized = language.toLowerCase();
	return normalized === 'spanish' ? 'Español' : normalized === 'english' ? 'English' : language;
}

function formatPercentage(value: number) {
	return `${roundMetric(value).toFixed(value % 1 === 0 ? 0 : 2)}%`;
}

function formatMetric(value: number) {
	return `${roundMetric(value).toFixed(value % 1 === 0 ? 0 : 1)}`;
}

function formatDuration(seconds: number) {
	if (seconds < 60) {
		return `${seconds}s`;
	}

	const minutes = Math.floor(seconds / 60);
	const rest = seconds % 60;
	return `${minutes}m ${rest}s`;
}

function computeMetrics(input: string, target: string, startedAt: number | null, forceDuration?: number): TypingMetrics {
	const typedCharacters = input.length;
	const comparableLength = Math.min(typedCharacters, target.length);
	let correctCharacters = 0;

	for (let index = 0; index < comparableLength; index += 1) {
		if (input[index] === target[index]) {
			correctCharacters += 1;
		}
	}

	const durationInSeconds = Math.max(
		1,
		forceDuration || (startedAt ? Math.ceil((Date.now() - startedAt) / 1000) : 1)
	);
	const durationInMinutes = durationInSeconds / 60;
	const rawWpm = typedCharacters === 0 ? 0 : typedCharacters / 5 / durationInMinutes;
	const wpm = correctCharacters === 0 ? 0 : correctCharacters / 5 / durationInMinutes;
	const accuracy = typedCharacters === 0 ? 100 : (correctCharacters / typedCharacters) * 100;

	return {
		wpm: roundMetric(wpm),
		rawWpm: roundMetric(rawWpm),
		accuracy: roundMetric(accuracy),
		durationInSeconds,
		correctCharacters,
		typedCharacters,
		mistakes: Math.max(typedCharacters - correctCharacters, 0)
	};
}

function renderQuoteText(target: HTMLElement, quoteText: string, input: string) {
	const characters = quoteText.split('');
	const markup = characters
		.map((character, index) => {
			let className = 'is-pending';

			if (index < input.length) {
				className = input[index] === character ? 'is-correct' : 'is-wrong';
			} else if (index === input.length) {
				className = 'is-current';
			}

			const visibleCharacter = character === ' ' ? ' ' : escapeHtml(character);
			return `<span class="typing-char ${className}">${visibleCharacter}</span>`;
		})
		.join('');

	target.innerHTML = markup;
}

function renderHistory(target: HTMLElement, results: TypingResult[]) {
	if (results.length === 0) {
		target.innerHTML = '<li class="typing-history__empty">Todavía no guardaste resultados. Tu próxima corrida arranca el historial.</li>';
		return;
	}

	target.innerHTML = results
		.slice(0, 6)
		.map(
			(result) => `
				<li>
					<div>
						<strong>${formatMetric(result.wpm)} WPM</strong>
						<span>${formatMetric(result.accuracy)}% accuracy • ${formatDuration(result.duration)}</span>
					</div>
					<div>
						<strong>${getModeLabel(result.mode as UserPreferences['defaultMode'])}</strong>
						<span>${formatDateTime(result.createdAt)}</span>
					</div>
				</li>
			`
		)
		.join('');
}

function createTonePlayer() {
	let context: AudioContext | null = null;

	return (enabled: boolean, tone: 'error' | 'success') => {
		if (!enabled) {
			return;
		}

		const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!AudioContextCtor) {
			return;
		}

		context ??= new AudioContextCtor();
		void context.resume();

		const oscillator = context.createOscillator();
		const gain = context.createGain();
		oscillator.type = tone === 'success' ? 'triangle' : 'square';
		oscillator.frequency.value = tone === 'success' ? 620 : 180;
		gain.gain.value = tone === 'success' ? 0.03 : 0.015;

		oscillator.connect(gain);
		gain.connect(context.destination);
		oscillator.start();
		oscillator.stop(context.currentTime + (tone === 'success' ? 0.12 : 0.06));
		gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.12);
	};
}

export function initHomePage() {
	const session = requireSession();
	if (!session) {
		return;
	}

	const page = document.querySelector<HTMLElement>('[data-typing-page]');
	if (!page || page.dataset.bound === 'true') {
		return;
	}

	page.dataset.bound = 'true';

	const status = page.querySelector<HTMLElement>('[data-typing-status]');
	const quoteText = page.querySelector<HTMLElement>('[data-quote-text]');
	const quoteSource = page.querySelector<HTMLElement>('[data-quote-source]');
	const textArea = page.querySelector<HTMLTextAreaElement>('[data-typing-input]');
	const quoteSurface = page.querySelector<HTMLElement>('[data-quote-surface]');
	const panning = page.querySelector<HTMLElement>('[data-typing-panning]');
	const caret = page.querySelector<HTMLElement>('[data-typing-caret]');
	const userName = page.querySelector<HTMLElement>('[data-home-user-name]');
	const userEmail = page.querySelector<HTMLElement>('[data-home-user-email]');
	const logoutButton = page.querySelector<HTMLButtonElement>('[data-action="logout"]');
	const configButtons = Array.from(page.querySelectorAll<HTMLButtonElement>('[data-pref-key]'));
	const historyList = page.querySelector<HTMLElement>('[data-history-list]');
	const resultCard = page.querySelector<HTMLElement>('[data-result-card]');
	const resultTitle = page.querySelector<HTMLElement>('[data-result-title]');
	const resultSummary = page.querySelector<HTMLElement>('[data-result-summary]');
	const resultMetricWpm = page.querySelector<HTMLElement>('[data-result-metric="wpm"]');
	const resultMetricRaw = page.querySelector<HTMLElement>('[data-result-metric="raw"]');
	const resultMetricAccuracy = page.querySelector<HTMLElement>('[data-result-metric="accuracy"]');
	const resultMetricTime = page.querySelector<HTMLElement>('[data-result-metric="time"]');
	const statWpm = page.querySelector<HTMLElement>('[data-stat="wpm"]');
	const statRaw = page.querySelector<HTMLElement>('[data-stat="raw"]');
	const statAccuracy = page.querySelector<HTMLElement>('[data-stat="accuracy"]');
	const statTimer = page.querySelector<HTMLElement>('[data-stat="timer"]');
	const statMode = page.querySelector<HTMLElement>('[data-current-mode]');
	const statLanguage = page.querySelector<HTMLElement>('[data-current-language]');
	const liveWpmCard = page.querySelector<HTMLElement>('[data-live-wpm-card]');
	const restartButtons = Array.from(page.querySelectorAll<HTMLButtonElement>('[data-action="restart"]'));
	const nextQuoteButtons = Array.from(page.querySelectorAll<HTMLButtonElement>('[data-action="next-quote"]'));
	const focusButtons = Array.from(page.querySelectorAll<HTMLElement>('[data-action="focus-input"]'));

	if (!quoteText || !quoteSource || !textArea || !quoteSurface || !panning || !caret || !historyList || !resultCard || !resultTitle || !resultSummary || !resultMetricWpm || !resultMetricRaw || !resultMetricAccuracy || !resultMetricTime || !statWpm || !statRaw || !statAccuracy || !statTimer || !statMode || !statLanguage || restartButtons.length === 0 || nextQuoteButtons.length === 0 || focusButtons.length === 0 || !liveWpmCard) {
		return;
	}

	const playTone = createTonePlayer();
	const state = {
		preferences: { ...DEFAULT_PREFERENCES } as UserPreferences,
		quote: null as TypingQuote | null,
		results: [] as TypingResult[],
		startedAt: null as number | null,
		completed: false,
		lastMistakeCount: 0,
		timerId: 0 as number | undefined,
		isUpdatingPreferences: false
	};

	const syncPreferenceButtons = () => {
		configButtons.forEach((button) => {
			const key = button.dataset.prefKey as keyof UserPreferences | undefined;
			if (!key) {
				return;
			}

			const isToggle = button.dataset.prefToggle === 'true';
			const isActive = isToggle
				? Boolean(state.preferences[key])
				: String(state.preferences[key]) === String(button.dataset.prefValue || '');

			button.classList.toggle('is-active', isActive);
			button.disabled = state.isUpdatingPreferences;
		});
	};

	const syncPreferenceLabels = () => {
		statMode.textContent = getModeLabel(state.preferences.defaultMode);
		statLanguage.textContent = getLanguageLabel(state.quote?.language || state.preferences.language);
		liveWpmCard.hidden = !state.preferences.showLiveWpm;
		syncPreferenceButtons();
	};

	const updateStats = (metrics: TypingMetrics, timeLabel: string) => {
		statWpm.textContent = formatMetric(metrics.wpm);
		statRaw.textContent = formatMetric(metrics.rawWpm);
		statAccuracy.textContent = formatPercentage(metrics.accuracy);
		statTimer.textContent = timeLabel;
	};

	const syncQuoteViewport = () => {
		const characters = Array.from(quoteText.querySelectorAll<HTMLElement>('.typing-char'));

		if (characters.length === 0) {
			panning.style.transform = 'translateY(0px)';
			caret.style.transform = 'translate(0px, 0px)';
			textArea.scrollTop = 0;
			quoteSurface.style.height = '';
			return;
		}

		const lineTops: number[] = [];
		const charLineIndexes: number[] = [];
		let currentTop: number | null = null;
		let currentLine = -1;

		characters.forEach((character, index) => {
			const top = character.offsetTop;

			if (currentTop === null || top !== currentTop) {
				currentTop = top;
				currentLine += 1;
				lineTops.push(top);
			}

			charLineIndexes[index] = currentLine;
		});

		const computedLineHeight = Number.parseFloat(window.getComputedStyle(quoteText).lineHeight);
		const fallbackHeight = characters[0]?.getBoundingClientRect().height || 0;
		const lineHeight = Number.isFinite(computedLineHeight) ? computedLineHeight : fallbackHeight;
		const visibleLines = 3;
		const viewportHeight = lineHeight * visibleLines;
		const inputIndex = Math.min(textArea.value.length, Math.max(characters.length - 1, 0));
		const activeLine = charLineIndexes[inputIndex] ?? 0;
		const maxStartLine = Math.max(lineTops.length - visibleLines, 0);
		const startLine = Math.min(Math.max(activeLine - 1, 0), maxStartLine);
		const offset = lineTops[startLine] ?? 0;

		quoteSurface.style.height = `${viewportHeight}px`;
		panning.style.transform = `translateY(${-offset}px)`;

		const activeChar = characters[inputIndex];
		if (activeChar) {
			let caretX = activeChar.offsetLeft;
			const caretY = activeChar.offsetTop;
			
			if (textArea.value.length >= characters.length) {
				caretX += activeChar.offsetWidth;
			}
			
			caret.style.height = `${activeChar.offsetHeight}px`;
			caret.style.animation = 'none';
			void caret.offsetWidth;
			caret.style.animation = '';
			caret.style.transform = `translate(${caretX}px, ${caretY}px)`;
		}
	};

	const clearTimer = () => {
		if (!state.timerId) {
			return;
		}

		window.clearInterval(state.timerId);
		state.timerId = undefined;
	};

	const ensureTimerRunning = () => {
		if (state.preferences.defaultMode !== 'time' || state.completed || state.timerId) {
			return;
		}

		state.startedAt ??= Date.now();
		state.timerId = window.setInterval(updateLiveState, 200);
	};

	const syncInputWithQuoteLimit = () => {
		if (!state.quote) {
			return;
		}

		if (textArea.value.length > state.quote.text.length) {
			textArea.value = textArea.value.slice(0, state.quote.text.length);
		}
	};

	const resetRun = () => {
		clearTimer();

		state.startedAt = null;
		state.completed = false;
		state.lastMistakeCount = 0;
		textArea.value = '';
		textArea.scrollTop = 0;
		textArea.removeAttribute('disabled');
		resultCard.hidden = true;
		clearStatus(status);

		if (state.quote) {
			renderQuoteText(quoteText, state.quote.text, '');
			syncQuoteViewport();
		}

		const initialTimerLabel = state.preferences.defaultMode === 'time' ? `${TIME_MODE_DURATION_SECONDS}s` : '0s';
		updateStats(computeMetrics('', state.quote?.text || '', null), initialTimerLabel);
		ensureTimerRunning();
		if (state.preferences.defaultMode === 'time') {
			updateLiveState();
		}
		textArea.focus();
	};

	const completeRun = async (reason: 'completed' | 'timeout') => {
		if (!state.quote || state.completed) {
			return;
		}

		state.completed = true;
		textArea.setAttribute('disabled', 'true');

		clearTimer();

		const forcedDuration =
			reason === 'timeout' && state.preferences.defaultMode === 'time'
				? TIME_MODE_DURATION_SECONDS
				: undefined;
		const metrics = computeMetrics(textArea.value, state.quote.text, state.startedAt, forcedDuration);
		updateStats(metrics, formatDuration(metrics.durationInSeconds));
		playTone(state.preferences.soundEnabled, 'success');

		resultCard.hidden = false;
		resultTitle.textContent = reason === 'timeout' ? 'Tiempo cumplido' : 'Test completado';
		resultSummary.textContent = `${formatMetric(metrics.wpm)} WPM • ${formatPercentage(metrics.accuracy)} accuracy • ${metrics.mistakes} errores`;
		resultMetricWpm.textContent = formatMetric(metrics.wpm);
		resultMetricRaw.textContent = formatMetric(metrics.rawWpm);
		resultMetricAccuracy.textContent = formatPercentage(metrics.accuracy);
		resultMetricTime.textContent = formatDuration(metrics.durationInSeconds);

		try {
			const savedResult = await createResult(session, {
				wpm: metrics.wpm,
				rawWpm: metrics.rawWpm,
				accuracy: metrics.accuracy,
				mode: state.preferences.defaultMode,
				duration: metrics.durationInSeconds,
				language: state.preferences.language,
				quoteId: state.quote.id,
				quoteSource: state.quote.source
			});

			state.results = [savedResult, ...state.results];
			renderHistory(historyList, state.results);
			void showToast({
				title: 'Resultado guardado',
				text: 'Tu corrida ya quedó en el historial.',
				icon: 'success',
				timer: 1800
			});
		} catch (error) {
			setStatus(status, error instanceof Error ? error.message : 'No se pudo guardar el resultado.', 'error');
		}
	};

	const updateLiveState = () => {
		if (!state.quote) {
			return;
		}

		syncInputWithQuoteLimit();

		const metrics = computeMetrics(textArea.value, state.quote.text, state.startedAt);
		const elapsedSeconds = state.startedAt ? Math.ceil((Date.now() - state.startedAt) / 1000) : 0;
		const remainingSeconds = Math.max(TIME_MODE_DURATION_SECONDS - elapsedSeconds, 0);
		const timeLabel =
			state.preferences.defaultMode === 'time'
				? `${remainingSeconds}s`
				: formatDuration(elapsedSeconds);

		updateStats(metrics, timeLabel);
		renderQuoteText(quoteText, state.quote.text, textArea.value);
		syncQuoteViewport();

		if (metrics.mistakes > state.lastMistakeCount) {
			playTone(state.preferences.soundEnabled, 'error');
		}
		state.lastMistakeCount = metrics.mistakes;

		if (state.preferences.defaultMode === 'time' && elapsedSeconds >= TIME_MODE_DURATION_SECONDS) {
			void completeRun('timeout');
			return;
		}

		if (textArea.value.length === state.quote.text.length && textArea.value === state.quote.text) {
			void completeRun('completed');
		}
	};

	const startIfNeeded = () => {
		if (state.startedAt || state.completed || state.preferences.defaultMode === 'time') {
			return;
		}

		state.startedAt = Date.now();
	};

	const loadQuote = async () => {
		setStatus(status, 'Cargando quote desde el backend...', 'info');
		textArea.setAttribute('disabled', 'true');

		try {
			state.quote = await getQuoteWithFallback(state.preferences);
			quoteSource.textContent = state.quote.source
				? `${state.quote.source} • ${getLanguageLabel(state.quote.language)}`
				: `Quote backend • ${getLanguageLabel(state.quote.language)}`;
			syncPreferenceLabels();
			resetRun();
			clearStatus(status);
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) {
				handleAuthFailure();
				return;
			}

			setStatus(status, error instanceof Error ? error.message : 'No se pudo obtener una quote.', 'error');
		}
	};

	const updatePreferences = async (payload: Partial<UserPreferences>) => {
		if (state.isUpdatingPreferences || Object.keys(payload).length === 0) {
			return;
		}

		state.isUpdatingPreferences = true;
		syncPreferenceButtons();

		try {
			state.preferences = await updateMyPreferences(session, payload);
			applyThemePreference(state.preferences.theme);
			syncPreferenceLabels();

			if (payload.language || payload.defaultMode) {
				await loadQuote();
			}
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) {
				handleAuthFailure();
				return;
			}

			setStatus(status, error instanceof Error ? error.message : 'No se pudieron actualizar las preferencias.', 'error');
		} finally {
			state.isUpdatingPreferences = false;
			syncPreferenceButtons();
		}
	};

	bindLogout(logoutButton);
	if (userName) userName.textContent = session.user.name;
	if (userEmail) userEmail.textContent = session.user.email;

	void syncCurrentUser(session, (user) => {
		if (userName) userName.textContent = user.name;
		if (userEmail) userEmail.textContent = user.email;
	});

	restartButtons.forEach((button) => {
		button.addEventListener('click', () => {
			resetRun();
			textArea.focus();
		});
	});

	nextQuoteButtons.forEach((button) => {
		button.addEventListener('click', () => {
			void loadQuote();
		});
	});

	focusButtons.forEach((button) => {
		button.addEventListener('click', () => {
			textArea.focus();
		});
	});

	configButtons.forEach((button) => {
		button.addEventListener('click', () => {
			const key = button.dataset.prefKey as keyof UserPreferences | undefined;
			if (!key) {
				return;
			}

			const nextValue =
				button.dataset.prefToggle === 'true'
					? !Boolean(state.preferences[key])
					: (button.dataset.prefValue as UserPreferences[keyof UserPreferences]);

			if (state.preferences[key] === nextValue) {
				return;
			}

			void updatePreferences({ [key]: nextValue } as Partial<UserPreferences>);
		});
	});

	textArea.addEventListener('input', () => {
		if (!state.quote || state.completed) {
			return;
		}

		syncInputWithQuoteLimit();
		startIfNeeded();
		updateLiveState();
	});

	page.addEventListener('keydown', (event) => {
		const isTypingKey = event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete' || event.key === 'Enter';

		if (event.key === 'Escape') {
			event.preventDefault();
			resetRun();
			return;
		}

		if (event.key === 'Tab' && document.activeElement !== textArea) {
			event.preventDefault();
			textArea.focus();
			return;
		}

		if (event.key === 'Enter' && state.completed) {
			event.preventDefault();
			void loadQuote();
			return;
		}

		if (!state.completed && document.activeElement !== textArea && !event.ctrlKey && !event.metaKey && !event.altKey && isTypingKey) {
			textArea.focus();
		}
	});

	window.addEventListener('resize', () => {
		if (!state.quote) {
			return;
		}

		renderQuoteText(quoteText, state.quote.text, textArea.value);
		syncQuoteViewport();
	});

	void Promise.all([getMyPreferences(session), getMyResults(session)])
		.then(async ([preferences, results]) => {
			state.preferences = preferences;
			applyThemePreference(preferences.theme);
			syncPreferenceLabels();
			state.results = results;
			renderHistory(historyList, results);
			await loadQuote();
		})
		.catch(async (error) => {
			if (error instanceof ApiError && error.status === 401) {
				handleAuthFailure();
				return;
			}

			await showErrorAlert(error instanceof Error ? error.message : 'No se pudo cargar la experiencia de typing.');
		});
}
