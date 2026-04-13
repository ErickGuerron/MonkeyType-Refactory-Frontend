import { ApiError } from '../../infrastructure/api/auth-api';
import { Chart, type ChartConfiguration } from 'chart.js/auto';
import { showErrorAlert, showToast } from '../../infrastructure/browser/alerts';
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
} from '../../infrastructure/api/typing-api';
import { countWords, deriveTypingText } from '../../core/typing/text-transform';
import {
	applyThemePreference,
	bindLogout,
	clearStatus,
	formatDateTime,
	handleAuthFailure,
	requireSession,
	setStatus,
	syncCurrentUser
} from '../../core/session/private-session';
import { getCurrentUiLocale, t } from '../../core/i18n';

interface TypingMetrics {
	wpm: number;
	rawWpm: number;
	accuracy: number;
	durationInSeconds: number;
	correctCharacters: number;
	correctWordCharacters: number;
	correctSpaces: number;
	extraCharacters: number;
	missedCharacters: number;
	typedCharacters: number;
	mistakes: number;
	totalKeyStrokes: number;
	incorrectKeyStrokes: number;
}

interface MetricSample {
	elapsedMs: number;
	wpm: number;
	rawWpm: number;
	burstWpm: number;
	typedCharactersAtSample: number;
	correctCharactersAtSample: number;
	totalKeyStrokesAtSample: number;
	incorrectKeyStrokesAtSample: number;
}

interface ChartPoint {
	x: number;
	y: number;
}

type WordModeCount = 50 | 100 | 150;

interface CharacterBreakdown {
	correctWordCharacters: number;
	allCorrectCharacters: number;
	incorrectCharacters: number;
	extraCharacters: number;
	missedCharacters: number;
	spaces: number;
	correctSpaces: number;
}

const WORD_MODE_COUNTS: WordModeCount[] = [50, 100, 150];
const DEFAULT_WORD_MODE_COUNT: WordModeCount = 50;

const TIME_TO_QUOTE_LENGTH: Record<30 | 60 | 120, 'short' | 'medium' | 'long'> = {
	30: 'short',
	60: 'medium',
	120: 'long'
};

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

function getQuoteLengthForMode(preferences: UserPreferences): 'short' | 'medium' | 'long' {
	if (preferences.defaultMode === 'time') {
		return TIME_TO_QUOTE_LENGTH[preferences.timeDuration];
	}

	return 'short';
}

function shouldRequestNumbersOnlyQuotes(preferences: UserPreferences) {
	return preferences.numbersEnabled
		&& (preferences.defaultMode === 'words' || preferences.defaultMode === 'time');
}

async function getQuoteWithFallback(
	preferences: UserPreferences,
	preferredLength?: 'short' | 'medium' | 'long'
) {
	const resolvedLength = preferredLength ?? (preferences.defaultMode === 'quote' ? 'long' : getQuoteLengthForMode(preferences));
	const hasNumbers = shouldRequestNumbersOnlyQuotes(preferences) ? true : undefined;
	const attempts: Array<{ language?: string; length?: 'short' | 'medium' | 'long'; hasNumbers?: boolean }> = resolvedLength
		? [
			{ language: preferences.language, length: resolvedLength, hasNumbers },
			{ language: preferences.language, hasNumbers },
			{ language: 'english', length: resolvedLength, hasNumbers },
			{ hasNumbers }
		]
		: [
			{ language: preferences.language, hasNumbers },
			{ language: 'english', hasNumbers },
			{ hasNumbers }
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

	throw lastError instanceof Error ? lastError : new Error(t('home.error.quoteUnavailable'));
}

function getPreferredLengthForWordsMode(wordCount: WordModeCount): 'short' | 'medium' | 'long' {
	if (wordCount <= 50) {
		return 'medium';
	}

	return 'long';
}

function getCorrectPrefixLength(input: string, target: string) {
	const comparableLength = Math.min(input.length, target.length);
	for (let index = 0; index < comparableLength; index += 1) {
		if (input[index] !== target[index]) {
			return index;
		}
	}

	return comparableLength;
}

function countCompletedWords(input: string, target: string) {
	const prefix = target.slice(0, getCorrectPrefixLength(input, target));
	const tokens = prefix.match(/\S+\s+/g) || [];
	const nextCharacter = target[prefix.length] || '';
	const endsWithCompleteWord = /\S+$/.test(prefix) && (prefix.length === target.length || /\s/.test(nextCharacter));
	return tokens.length + (endsWithCompleteWord ? 1 : 0);
}

function createSyntheticQuote(text: string, source: string | null, language: string, length: TypingQuote['length'], hasNumbers = false): TypingQuote {
	const now = new Date().toISOString();

	return {
		id: `synthetic-${language}-${length}-${Date.now()}`,
		text,
		source,
		language,
		length,
		hasNumbers,
		tags: ['synthetic'],
		createdAt: now,
		updatedAt: now
	};
}

async function buildWordsModeQuote(preferences: UserPreferences, wordCount: WordModeCount) {
	const preferredLength = getPreferredLengthForWordsMode(wordCount);
	const collectedQuotes: TypingQuote[] = [];
	let combinedText = '';
	let attempts = 0;

	while (
		countWords(
			deriveTypingText({
				baseText: combinedText,
				language: collectedQuotes[0]?.language || preferences.language,
				mode: 'words',
				wordCount,
				punctuationEnabled: preferences.punctuationEnabled,
				numbersEnabled: preferences.numbersEnabled,
				quoteHasNumbers: collectedQuotes.some((quote) => quote.hasNumbers)
			})
		) < wordCount
		&& attempts < 8
	) {
		attempts += 1;
		const quote = await getQuoteWithFallback(preferences, preferredLength);
		collectedQuotes.push(quote);
		combinedText = [...new Set(collectedQuotes.map((item) => item.text.trim()).filter(Boolean))].join(' ');
	}

	if (
		countWords(
			deriveTypingText({
				baseText: combinedText,
				language: collectedQuotes[0]?.language || preferences.language,
				mode: 'words',
				wordCount,
				punctuationEnabled: preferences.punctuationEnabled,
				numbersEnabled: preferences.numbersEnabled,
				quoteHasNumbers: collectedQuotes.some((quote) => quote.hasNumbers)
			})
		) < wordCount
	) {
		throw new Error(t('home.error.wordsSeedUnavailable', { count: wordCount }));
	}

	const language = collectedQuotes[0]?.language || preferences.language;
	const source = `Words seed mix • ${wordCount} words`;

	return createSyntheticQuote(combinedText, source, language, preferredLength, collectedQuotes.some((quote) => quote.hasNumbers));
}

function getModeLabel(mode: UserPreferences['defaultMode']) {
	const isSpanish = getCurrentUiLocale() === 'es';
	const labels: Record<UserPreferences['defaultMode'], string> = {
		time: isSpanish ? 'Tiempo' : 'Time',
		words: isSpanish ? 'Palabras' : 'Words',
		quote: 'Quote',
		zen: 'Zen',
		custom: 'Custom'
	};

	return labels[mode] || mode;
}

function getModeDisplayLabel(preferences: UserPreferences, wordCount: WordModeCount) {
	if (preferences.defaultMode === 'time') {
		return t('home.mode.timeDisplay', { duration: preferences.timeDuration });
	}

	if (preferences.defaultMode === 'words') {
		return t('home.mode.wordsDisplay', { count: wordCount });
	}

	return getModeLabel(preferences.defaultMode);
}

function getLanguageLabel(language: string) {
	const normalized = language.toLowerCase();
	return normalized === 'spanish' ? t('settings.language.spanish') : normalized === 'english' ? t('settings.language.english') : language;
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

function countCharacterBreakdown(input: string, target: string, final = false, defaultMode: UserPreferences['defaultMode'] = 'quote'): CharacterBreakdown {
	const inputWords = input.length > 0 ? input.split(' ') : [''];
	const targetWords = target.length > 0 ? target.split(' ') : [''];

	let correctWordCharacters = 0;
	let allCorrectCharacters = 0;
	let incorrectCharacters = 0;
	let extraCharacters = 0;
	let missedCharacters = 0;
	const spaces = Math.max(inputWords.length - 1, 0);
	let correctSpaces = 0;

	for (let wordIndex = 0; wordIndex < inputWords.length; wordIndex += 1) {
		const inputWord = inputWords[wordIndex] || '';
		const targetWord = targetWords[wordIndex] || '';

		if (inputWord === targetWord) {
			correctWordCharacters += targetWord.length;
			allCorrectCharacters += targetWord.length;
			if (wordIndex < inputWords.length - 1) {
				correctSpaces += 1;
			}
			continue;
		}

		if (inputWord.length >= targetWord.length) {
			for (let charIndex = 0; charIndex < inputWord.length; charIndex += 1) {
				if (charIndex < targetWord.length) {
					if (inputWord[charIndex] === targetWord[charIndex]) {
						allCorrectCharacters += 1;
					} else {
						incorrectCharacters += 1;
					}
				} else {
					extraCharacters += 1;
				}
			}
			continue;
		}

		let partialCorrect = 0;
		let partialIncorrect = 0;
		let partialMissed = 0;

		for (let charIndex = 0; charIndex < targetWord.length; charIndex += 1) {
			if (charIndex < inputWord.length) {
				if (inputWord[charIndex] === targetWord[charIndex]) {
					partialCorrect += 1;
				} else {
					partialIncorrect += 1;
				}
			} else {
				partialMissed += 1;
			}
		}

		allCorrectCharacters += partialCorrect;
		incorrectCharacters += partialIncorrect;

		const shouldCountPartialLastWord = !final || (final && defaultMode === 'time');
		if (wordIndex === inputWords.length - 1 && shouldCountPartialLastWord) {
			if (partialIncorrect === 0) {
				correctWordCharacters += partialCorrect;
			}
		} else {
			missedCharacters += partialMissed;
		}
	}

	return {
		correctWordCharacters,
		allCorrectCharacters,
		incorrectCharacters,
		extraCharacters,
		missedCharacters,
		spaces,
		correctSpaces
	};
}

function computeMetrics(
	input: string,
	target: string,
	startedAt: number | null,
	totalKeyStrokes = input.length,
	incorrectKeyStrokes = Math.max(input.length - target.split('').filter((character, index) => input[index] === character).length, 0),
	defaultMode: UserPreferences['defaultMode'] = 'quote',
	final = false
): TypingMetrics {
	const typedCharacters = input.length;
	const breakdown = countCharacterBreakdown(input, target, final, defaultMode);
	const correctCharacters = breakdown.allCorrectCharacters;

	const durationInSeconds = Math.max(
		1,
		startedAt ? Math.ceil((Date.now() - startedAt) / 1000) : 1
	);
	const durationInMinutes = durationInSeconds / 60;
	const rawCharacters = breakdown.allCorrectCharacters + breakdown.spaces + breakdown.incorrectCharacters + breakdown.extraCharacters;
	const rawWpm = rawCharacters === 0 ? 0 : rawCharacters / 5 / durationInMinutes;
	const netCharacters = breakdown.correctWordCharacters + breakdown.correctSpaces;
	const wpm = netCharacters === 0 ? 0 : netCharacters / 5 / durationInMinutes;
	const normalizedTotalKeyStrokes = Math.max(totalKeyStrokes, typedCharacters, 1);
	const normalizedIncorrectKeyStrokes = Math.max(0, Math.min(incorrectKeyStrokes, normalizedTotalKeyStrokes));
	const accuracy = ((normalizedTotalKeyStrokes - normalizedIncorrectKeyStrokes) / normalizedTotalKeyStrokes) * 100;

	return {
		wpm: roundMetric(wpm),
		rawWpm: roundMetric(rawWpm),
		accuracy: roundMetric(accuracy),
		durationInSeconds,
		correctCharacters,
		correctWordCharacters: breakdown.correctWordCharacters,
		correctSpaces: breakdown.correctSpaces,
		extraCharacters: breakdown.extraCharacters,
		missedCharacters: breakdown.missedCharacters,
		typedCharacters,
		mistakes: normalizedIncorrectKeyStrokes,
		totalKeyStrokes: normalizedTotalKeyStrokes,
		incorrectKeyStrokes: normalizedIncorrectKeyStrokes
	};
}

function calculateBurstMetric(input: string, burstStartedAt: number | null, burstStartIndex: number) {
	if (!burstStartedAt) {
		return 0;
	}

	const elapsedSeconds = Math.max((Date.now() - burstStartedAt) / 1000, 0.12);
	const slice = input.slice(burstStartIndex);
	let burstChars = slice.replace(/\s+$/g, '').length;

	if (burstChars === 0) {
		const previousWord = input.slice(0, burstStartIndex).trimEnd().split(/\s+/).pop() || '';
		burstChars = previousWord.length;
	}

	if (burstChars === 0) {
		return 0;
	}

	return roundMetric((burstChars / 5) / (elapsedSeconds / 60));
}

function renderQuoteText(
	target: HTMLElement,
	quoteText: string,
	input: string,
	mode: UserPreferences['defaultMode'],
	completed = false
) {
	if (mode === 'zen') {
		const typedMarkup = input
			.split('')
			.map((character) => {
				const visibleCharacter = character === ' ' ? ' ' : escapeHtml(character);
				return `<span class="typing-char is-correct">${visibleCharacter}</span>`;
			})
			.join('');
		const cursorMarkup = completed ? '' : '<span class="typing-char is-current">&nbsp;</span>';
		target.innerHTML = typedMarkup || cursorMarkup;
		if (typedMarkup && cursorMarkup) {
			target.innerHTML = `${typedMarkup}${cursorMarkup}`;
		}
		return;
	}

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
		target.innerHTML = `<li class="typing-history__empty">${t('home.historyEmpty')}</li>`;
		return;
	}

	target.innerHTML = results
		.slice(0, 6)
		.map(
			(result) => `
				<li>
					<div>
						<strong>${formatMetric(result.wpm)} WPM</strong>
						<span>${formatMetric(result.accuracy)}% ${t('common.accuracy')} • ${formatDuration(result.duration)}</span>
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
	const typingHint = page.querySelector<HTMLElement>('[data-typing-hint]');
	const userName = page.querySelector<HTMLElement>('[data-home-user-name]');
	const userEmail = page.querySelector<HTMLElement>('[data-home-user-email]');
	const logoutButton = page.querySelector<HTMLButtonElement>('[data-action="logout"]');
	const configButtons = Array.from(page.querySelectorAll<HTMLButtonElement>('[data-pref-key]'));
	const configSelects = Array.from(page.querySelectorAll<HTMLSelectElement>('[data-pref-select]'));
	const modeControlShells = Array.from(page.querySelectorAll<HTMLElement>('[data-mode-control]'));
	const historyList = page.querySelector<HTMLElement>('[data-history-list]');
	const resultCard = page.querySelector<HTMLElement>('[data-result-card]');
	const resultTitle = page.querySelector<HTMLElement>('[data-result-title]');
	const resultSummary = page.querySelector<HTMLElement>('[data-result-summary]');
	const resultMetricWpm = page.querySelector<HTMLElement>('[data-result-metric="wpm"]');
	const resultMetricRaw = page.querySelector<HTMLElement>('[data-result-metric="raw"]');
	const resultMetricAccuracy = page.querySelector<HTMLElement>('[data-result-metric="accuracy"]');
	const resultMetricTime = page.querySelector<HTMLElement>('[data-result-metric="time"]');
	const resultChart = page.querySelector<HTMLCanvasElement>('[data-result-chart]');
	const resultChartValue = page.querySelector<HTMLElement>('[data-result-chart-value]');
	const resultModeMeta = page.querySelector<HTMLElement>('[data-result-meta="mode"]');
	const resultLanguageMeta = page.querySelector<HTMLElement>('[data-result-meta="language"]');
	const statWpm = page.querySelector<HTMLElement>('[data-stat="wpm"]');
	const statRaw = page.querySelector<HTMLElement>('[data-stat="raw"]');
	const statAccuracy = page.querySelector<HTMLElement>('[data-stat="accuracy"]');
	const statTimer = page.querySelector<HTMLElement>('[data-stat="timer"]');
	const statTimerLabel = page.querySelector<HTMLElement>('.typing-stage__timer-label');
	const statMode = page.querySelector<HTMLElement>('[data-current-mode]');
	const statLanguage = page.querySelector<HTMLElement>('[data-current-language]');
	const liveWpmCard = page.querySelector<HTMLElement>('[data-live-wpm-card]');
	const finishZenButtons = Array.from(page.querySelectorAll<HTMLButtonElement>('[data-action="finish-zen"]'));
	const restartButtons = Array.from(page.querySelectorAll<HTMLButtonElement>('[data-action="restart"]'));
	const nextQuoteButtons = Array.from(page.querySelectorAll<HTMLButtonElement>('[data-action="next-quote"]'));
	const closeResultButtons = Array.from(page.querySelectorAll<HTMLElement>('[data-action="close-result"]'));
	const focusButtons = Array.from(page.querySelectorAll<HTMLElement>('[data-action="focus-input"]'));

	if (!quoteText || !quoteSource || !textArea || !quoteSurface || !panning || !caret || !typingHint || !historyList || !resultCard || !resultTitle || !resultSummary || !resultMetricWpm || !resultMetricRaw || !resultMetricAccuracy || !resultMetricTime || !resultChart || !resultChartValue || !resultModeMeta || !resultLanguageMeta || !statWpm || !statRaw || !statAccuracy || !statTimer || !statTimerLabel || !statMode || !statLanguage || restartButtons.length === 0 || nextQuoteButtons.length === 0 || closeResultButtons.length === 0 || focusButtons.length === 0 || !liveWpmCard) {
		return;
	}

	const playTone = createTonePlayer();
	let resultChartInstance: Chart<'line' | 'scatter', ChartPoint[]> | null = null;
	const modeSupportsTextSanitizers = () => state.preferences.defaultMode === 'words' || state.preferences.defaultMode === 'time';
	const shouldShowFinishZenAction = () => state.preferences.defaultMode === 'zen' && textArea.value.trim().length > 0;
	const state = {
		preferences: { ...DEFAULT_PREFERENCES } as UserPreferences,
		quoteSeed: null as TypingQuote | null,
		quote: null as TypingQuote | null,
		wordCount: DEFAULT_WORD_MODE_COUNT,
		resultQuoteId: null as string | null,
		resultQuoteSource: null as string | null,
		results: [] as TypingResult[],
		startedAt: null as number | null,
		currentBurstStartedAt: null as number | null,
		currentBurstStartIndex: 0,
		lastInputValue: '',
		completed: false,
		lastMistakeCount: 0,
		metricSamples: [] as MetricSample[],
		errorMoments: [] as number[],
		totalKeyStrokes: 0,
		incorrectKeyStrokes: 0,
		timerId: 0 as number | undefined,
		isUpdatingPreferences: false
	};

	const upsertMetricSample = (metrics: TypingMetrics, input: string) => {
		if (!state.startedAt) {
			return;
		}

		const elapsedMs = Math.max(Date.now() - state.startedAt, 250);
		const bucketMs = 1000;
		const bucketKey = Math.floor(elapsedMs / bucketMs);
		const lastSample = state.metricSamples[state.metricSamples.length - 1];
		const burstWpm = calculateBurstMetric(input, state.currentBurstStartedAt, state.currentBurstStartIndex);

		const sample: MetricSample = {
			elapsedMs,
			wpm: metrics.wpm,
			rawWpm: metrics.rawWpm,
			burstWpm,
			typedCharactersAtSample: metrics.typedCharacters,
			correctCharactersAtSample: metrics.correctCharacters,
			totalKeyStrokesAtSample: metrics.totalKeyStrokes,
			incorrectKeyStrokesAtSample: metrics.incorrectKeyStrokes
		};

		if (lastSample && Math.floor(lastSample.elapsedMs / bucketMs) === bucketKey) {
			state.metricSamples[state.metricSamples.length - 1] = sample;
			return;
		}

		state.metricSamples.push(sample);
	};

	const destroyResultChart = () => {
		resultChartInstance?.destroy();
		resultChartInstance = null;
	};

	const buildChartSamples = (metrics: TypingMetrics) => {
		const fallbackSample: MetricSample = {
			elapsedMs: Math.max(metrics.durationInSeconds * 1000, 1000),
			wpm: metrics.wpm,
			rawWpm: metrics.rawWpm,
			burstWpm: Math.max(metrics.rawWpm, metrics.wpm),
			typedCharactersAtSample: metrics.typedCharacters,
			correctCharactersAtSample: metrics.correctCharacters,
			totalKeyStrokesAtSample: metrics.totalKeyStrokes,
			incorrectKeyStrokesAtSample: metrics.incorrectKeyStrokes
		};
		const sourceSamples = state.metricSamples.length > 0 ? state.metricSamples : [fallbackSample];
		const samples = [...sourceSamples]
			.sort((left, right) => left.elapsedMs - right.elapsedMs)
			.reduce((accumulator, sample) => {
				const existing = accumulator[accumulator.length - 1];
				if (existing && existing.elapsedMs === sample.elapsedMs) {
					accumulator[accumulator.length - 1] = sample;
					return accumulator;
				}

				accumulator.push(sample);
				return accumulator;
			}, [] as MetricSample[]);

		if (!samples.length || samples[0].elapsedMs > 0) {
			samples.unshift({
				elapsedMs: 0,
				wpm: 0,
				rawWpm: 0,
				burstWpm: 0,
				typedCharactersAtSample: 0,
				correctCharactersAtSample: 0,
				totalKeyStrokesAtSample: 0,
				incorrectKeyStrokesAtSample: 0
			});
		}

		const finalElapsedMs = Math.max(metrics.durationInSeconds * 1000, samples[samples.length - 1]?.elapsedMs || 0, 1000);
		const lastSample = samples[samples.length - 1];
		if (!lastSample || lastSample.elapsedMs < finalElapsedMs) {
			samples.push({
				...(lastSample || fallbackSample),
				elapsedMs: finalElapsedMs,
				wpm: metrics.wpm,
				rawWpm: metrics.rawWpm,
				burstWpm: Math.max(lastSample?.burstWpm || 0, metrics.rawWpm)
			});
		}

		return samples;
	};

	const toChartPoints = (
		samples: MetricSample[],
		valueKey: keyof Pick<MetricSample, 'wpm' | 'rawWpm' | 'burstWpm'>
	) => {
		return samples.map((sample) => ({
			x: roundMetric(sample.elapsedMs / 1000),
			y: roundMetric(Number(sample[valueKey]))
		}));
	};

	const buildErrorPoints = (samples: MetricSample[], yValue: number) => {
		return state.errorMoments.map((elapsedErrorMs) => ({
			x: roundMetric(elapsedErrorMs / 1000),
			y: yValue,
			nearestSample: samples.reduce((closest, sample) => {
				return Math.abs(sample.elapsedMs - elapsedErrorMs) < Math.abs(closest.elapsedMs - elapsedErrorMs)
					? sample
					: closest;
			}, samples[0]!)
		})).map(({ x, nearestSample }) => ({
			x,
			y: roundMetric(Math.max(nearestSample.wpm, nearestSample.rawWpm, nearestSample.burstWpm, yValue * 0.92))
		}));
	};

	const renderResultGraph = (metrics: TypingMetrics) => {
		const samples = buildChartSamples(metrics);
		const maxDurationSeconds = Math.max(metrics.durationInSeconds, samples[samples.length - 1]?.elapsedMs / 1000 || 1, 1);
		const maxSpeed = Math.max(20, ...samples.map((sample) => Math.max(sample.wpm, sample.rawWpm, sample.burstWpm)));
		const errorAnchor = roundMetric(maxSpeed * 1.08);
		const yAxisMax = roundMetric(Math.max(errorAnchor, maxSpeed) * 1.08);
		const chartContext = resultChart.getContext('2d');
		const rootStyles = window.getComputedStyle(document.documentElement);
		const chartColors = {
			text: rootStyles.getPropertyValue('--text').trim() || '#f7f1dd',
			textMuted: rootStyles.getPropertyValue('--text-muted').trim() || 'rgba(247, 241, 221, 0.68)',
			borderStrong: rootStyles.getPropertyValue('--border-strong').trim() || 'rgba(224, 193, 109, 0.24)',
			surfaceStrong: rootStyles.getPropertyValue('--surface-strong').trim() || 'rgba(30, 31, 34, 0.94)'
		};

		if (!chartContext) {
			return;
		}

		destroyResultChart();

		const chartConfig: ChartConfiguration<'line' | 'scatter', ChartPoint[]> = {
			type: 'line',
			data: {
					datasets: [
						{
							label: 'BURST',
							data: toChartPoints(samples, 'burstWpm'),
							borderColor: 'rgba(116, 208, 241, 0.96)',
							backgroundColor: 'rgba(116, 208, 241, 0.16)',
							borderWidth: 2.4,
							pointRadius: 1.8,
							pointHoverRadius: 4,
							pointBackgroundColor: 'rgba(116, 208, 241, 0.96)',
							pointBorderWidth: 0,
							tension: 0.22
						},
						{
							label: 'WPM',
							data: toChartPoints(samples, 'wpm'),
							borderColor: '#e2b714',
							backgroundColor: 'rgba(226, 183, 20, 0.18)',
							borderWidth: 3.2,
							pointRadius: 2,
							pointHoverRadius: 4,
							pointBackgroundColor: '#e2b714',
							pointBorderWidth: 0,
							tension: 0.3
						},
						{
							label: 'RAW',
							data: toChartPoints(samples, 'rawWpm'),
							borderColor: chartColors.textMuted,
							backgroundColor: 'transparent',
							borderWidth: 2.2,
							borderDash: [8, 6],
							pointRadius: 1.6,
							pointHoverRadius: 4,
							pointBackgroundColor: chartColors.textMuted,
							pointBorderWidth: 0,
							tension: 0.28
						},
						{
						type: 'scatter',
						label: 'ERRORS',
						data: buildErrorPoints(samples, errorAnchor),
						showLine: false,
						pointRadius: state.errorMoments.length > 0 ? 5 : 0,
						pointHoverRadius: 6,
						pointStyle: 'crossRot',
						borderWidth: 2,
						borderColor: 'rgba(255, 107, 127, 0.95)',
						backgroundColor: 'rgba(255, 107, 127, 0.95)'
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: false,
				normalized: true,
				parsing: false,
				interaction: {
					mode: 'index',
					intersect: false
				},
				plugins: {
					legend: {
						display: false
					},
					tooltip: {
						backgroundColor: chartColors.surfaceStrong,
						borderColor: chartColors.borderStrong,
						borderWidth: 1,
						titleColor: chartColors.text,
						bodyColor: chartColors.textMuted,
						padding: 10,
						callbacks: {
							title(items) {
								const value = items[0]?.parsed.x ?? 0;
								return `${roundMetric(value)}s`;
							},
							label(item) {
							if (item.dataset.label === 'ERRORS') {
								return t('home.chart.tooltipError');
							}

							return t('home.chart.tooltipSeries', { label: item.dataset.label || '', value: formatMetric(item.parsed.y) });
						}
					}
					}
				},
				scales: {
					x: {
						type: 'linear',
						min: 0,
						max: maxDurationSeconds,
						grid: {
							display: false,
							drawTicks: true
						},
						border: {
							color: chartColors.borderStrong
						},
						ticks: {
							color: chartColors.textMuted,
							font: {
								family: 'var(--font-mono)',
								size: 11
							},
							callback(value) {
								return `${value}s`;
							}
						},
						title: {
							display: true,
							text: t('home.chart.timeAxis'),
							color: chartColors.textMuted,
							font: {
								family: 'var(--font-mono)',
								size: 11,
								weight: 'normal'
							}
						}
					},
					y: {
						min: 0,
						max: yAxisMax,
						grid: {
							display: false,
							drawTicks: true
						},
						border: {
							color: chartColors.borderStrong
						},
						ticks: {
							color: chartColors.textMuted,
							font: {
								family: 'var(--font-mono)',
								size: 11
							},
							callback(value) {
								return `${value}`;
							}
						},
						title: {
							display: true,
							text: t('home.chart.wpmAxis'),
							color: chartColors.textMuted,
							font: {
								family: 'var(--font-mono)',
								size: 11,
								weight: 'normal'
							}
						}
					}
				},
				elements: {
					line: {
						capBezierPoints: true
					}
				}
			}
		};

		resultChartInstance = new Chart(chartContext, chartConfig);
	};

	const syncPreferenceButtons = () => {
		configButtons.forEach((button) => {
			const prefPatch = button.dataset.prefPatch ? JSON.parse(button.dataset.prefPatch) as Partial<UserPreferences> : null;
			const key = button.dataset.prefKey as keyof UserPreferences | undefined;
			const isTextSanitizerToggle = key === 'punctuationEnabled' || key === 'numbersEnabled';
			const supportsTextSanitizers = modeSupportsTextSanitizers();

			if (isTextSanitizerToggle) {
				button.hidden = !supportsTextSanitizers;
				button.disabled = !supportsTextSanitizers || state.isUpdatingPreferences;
			} else {
				button.hidden = false;
			}

			if (!key) {
				if (prefPatch) {
					const isPatchActive = Object.entries(prefPatch).every(([patchKey, patchValue]) => state.preferences[patchKey as keyof UserPreferences] === patchValue);
					button.classList.toggle('is-active', isPatchActive);
					button.disabled = state.isUpdatingPreferences;
				}
				return;
			}

			const isToggle = button.dataset.prefToggle === 'true';
			const isActive = isToggle
				? Boolean(state.preferences[key])
				: String(state.preferences[key]) === String(button.dataset.prefValue || '');

			button.classList.toggle('is-active', isActive);
			if (!isTextSanitizerToggle) {
				button.disabled = state.isUpdatingPreferences;
			}
		});

		configSelects.forEach((select) => {
			const key = select.dataset.prefSelect as keyof UserPreferences | undefined;
			const shell = select.closest<HTMLElement>('[data-mode-control]');
			if (!key) {
				return;
			}

			if (key === 'timeMode') {
				if (shell) {
					shell.hidden = state.preferences.defaultMode !== 'time';
				}
				select.value = String(state.preferences.timeDuration);
				select.disabled = state.isUpdatingPreferences;
				return;
			}

			if (key === 'wordsMode') {
				if (shell) {
					shell.hidden = state.preferences.defaultMode !== 'words';
				}
				select.value = String(state.wordCount);
				select.disabled = state.isUpdatingPreferences;
				return;
			}

			select.value = String(state.preferences[key]);
			select.disabled = state.isUpdatingPreferences;
		});

		modeControlShells.forEach((shell) => {
			const mode = shell.dataset.modeControl as UserPreferences['defaultMode'] | undefined;
			if (!mode || (mode !== 'time' && mode !== 'words')) {
				return;
			}

			const shouldShow = state.preferences.defaultMode === mode;
			shell.hidden = !shouldShow;
			shell.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
			shell.style.display = shouldShow ? '' : 'none';
		});

		finishZenButtons.forEach((button) => {
			button.hidden = !shouldShowFinishZenAction();
		});
	};

	const syncDisplayedQuoteFromSeed = () => {
		if (!state.quoteSeed) {
			state.quote = null;
			return;
		}

		state.quote = {
			...state.quoteSeed,
			text: deriveTypingText({
				baseText: state.quoteSeed.text,
				language: state.quoteSeed.language,
				mode: state.preferences.defaultMode,
				quoteHasNumbers: state.quoteSeed.hasNumbers,
				wordCount: state.wordCount,
				punctuationEnabled: state.preferences.punctuationEnabled,
				numbersEnabled: state.preferences.numbersEnabled
			})
		};
	};

	const getProgressLabel = () => {
		if (!state.quote) {
			return '—';
		}

		if (state.preferences.defaultMode === 'words') {
			return `${Math.min(countCompletedWords(textArea.value, state.quote.text), state.wordCount)}/${state.wordCount}`;
		}

		if (state.preferences.defaultMode === 'quote') {
			const totalWords = countWords(state.quote.text);
			return `${Math.min(countCompletedWords(textArea.value, state.quote.text), totalWords)}/${totalWords}`;
		}

		return state.startedAt ? formatDuration(Math.ceil((Date.now() - state.startedAt) / 1000)) : '—';
	};

	const syncPreferenceLabels = () => {
		statMode.textContent = getModeDisplayLabel(state.preferences, state.wordCount);
		statTimerLabel.textContent = state.preferences.defaultMode === 'time'
			? t('home.time')
			: state.preferences.defaultMode === 'zen'
				? t('home.elapsed')
				: t('home.words');
		statLanguage.textContent = getLanguageLabel(state.quote?.language || state.preferences.language);
		typingHint.textContent = state.preferences.defaultMode === 'zen'
			? t('home.typingHintZen')
			: state.preferences.defaultMode === 'words'
				? t('home.typingHintWords', { count: state.wordCount })
				: t('home.typingHint');
		liveWpmCard.hidden = !state.preferences.showLiveWpm;
		syncPreferenceButtons();
	};

	const getInitialTimerLabel = () => {
		if (state.preferences.defaultMode === 'time') {
			return `${state.preferences.timeDuration}s`;
		}

		if (state.preferences.defaultMode === 'words') {
			return `0/${state.wordCount}`;
		}

		if (state.preferences.defaultMode === 'quote' && state.quote) {
			return `0/${countWords(state.quote.text)}`;
		}

		return '—';
	};

	const updateStats = (metrics: TypingMetrics, timeLabel: string) => {
		statWpm.textContent = formatMetric(metrics.wpm);
		statRaw.textContent = formatMetric(metrics.rawWpm);
		statAccuracy.textContent = formatPercentage(metrics.accuracy);
		statTimer.textContent = timeLabel;
	};

	const setQuoteSwitchingState = (isSwitching: boolean) => {
		page.dataset.quoteSwitching = isSwitching ? 'true' : 'false';
	};

	const hideResultModal = () => {
		resultCard.hidden = true;
	};

	const showResultModal = () => {
		resultCard.hidden = false;
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
		const visibleLines = 4;
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
		if (state.completed || state.timerId) {
			return;
		}

		state.timerId = window.setInterval(updateLiveState, 200);
	};

	const syncInputWithQuoteLimit = () => {
		if (!state.quote || state.preferences.defaultMode === 'zen') {
			return;
		}

		if (textArea.value.length > state.quote.text.length) {
			textArea.value = textArea.value.slice(0, state.quote.text.length);
		}
	};

	const resetRun = () => {
		clearTimer();

		state.startedAt = null;
		state.currentBurstStartedAt = null;
		state.currentBurstStartIndex = 0;
		state.lastInputValue = '';
		state.completed = false;
		state.lastMistakeCount = 0;
		state.metricSamples = [];
		state.errorMoments = [];
		state.totalKeyStrokes = 0;
		state.incorrectKeyStrokes = 0;
		destroyResultChart();
		textArea.value = '';
		textArea.scrollTop = 0;
		textArea.removeAttribute('disabled');
		hideResultModal();
		clearStatus(status);

		if (state.quote) {
			renderQuoteText(quoteText, state.quote.text, '', state.preferences.defaultMode);
			syncQuoteViewport();
		}

		const initialTimerLabel = getInitialTimerLabel();
		updateStats(computeMetrics('', state.preferences.defaultMode === 'zen' ? '' : state.quote?.text || '', null, 0, 0, state.preferences.defaultMode), initialTimerLabel);
		if (state.preferences.defaultMode !== 'time') {
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
		renderQuoteText(quoteText, state.quote.text, textArea.value, state.preferences.defaultMode, true);
		syncQuoteViewport();

		const metricsTarget = state.preferences.defaultMode === 'zen' ? textArea.value : state.quote.text;
		const metrics = computeMetrics(
			textArea.value,
			metricsTarget,
			state.startedAt,
			state.totalKeyStrokes,
			state.incorrectKeyStrokes,
			state.preferences.defaultMode,
			true
		);
		upsertMetricSample(metrics, textArea.value);
		updateStats(metrics, formatDuration(metrics.durationInSeconds));
		playTone(state.preferences.soundEnabled, 'success');

		showResultModal();
		resultTitle.textContent = reason === 'timeout' ? t('home.resultTimeout') : t('home.resultCompleted');
		resultSummary.textContent = t('home.resultSummary', {
			wpm: formatMetric(metrics.wpm),
			accuracy: `${formatPercentage(metrics.accuracy)} ${t('common.accuracy')}`,
			errors: metrics.mistakes
		});
		resultMetricWpm.textContent = formatMetric(metrics.wpm);
		resultMetricRaw.textContent = formatMetric(metrics.rawWpm);
		resultMetricAccuracy.textContent = formatPercentage(metrics.accuracy);
		resultMetricTime.textContent = formatDuration(metrics.durationInSeconds);
		resultChartValue.textContent = formatPercentage(metrics.accuracy);
		resultModeMeta.textContent = getModeDisplayLabel(state.preferences, state.wordCount).toLowerCase();
		resultLanguageMeta.textContent = getLanguageLabel(state.preferences.language).toLowerCase();
		renderResultGraph(metrics);

		try {
			const savedResult = await createResult(session, {
				wpm: metrics.wpm,
				rawWpm: metrics.rawWpm,
				accuracy: metrics.accuracy,
				mode: state.preferences.defaultMode,
				duration: metrics.durationInSeconds,
				language: state.preferences.language,
				quoteId: state.resultQuoteId,
				quoteSource: state.resultQuoteSource
			});

			state.results = [savedResult, ...state.results];
			renderHistory(historyList, state.results);
			void showToast({
				title: t('home.toastSavedTitle'),
				text: t('home.toastSavedBody'),
				icon: 'success',
				timer: 1800
			});
		} catch (error) {
			setStatus(status, error instanceof Error ? error.message : t('home.error.saveResult'), 'error');
		}
	};

	const updateLiveState = () => {
		if (!state.quote) {
			return;
		}

		syncInputWithQuoteLimit();

		const metricsTarget = state.preferences.defaultMode === 'zen' ? textArea.value : state.quote.text;
		const metrics = computeMetrics(
			textArea.value,
			metricsTarget,
			state.startedAt,
			state.totalKeyStrokes,
			state.incorrectKeyStrokes,
			state.preferences.defaultMode
		);
		const elapsedSeconds = state.startedAt ? Math.ceil((Date.now() - state.startedAt) / 1000) : 0;
		const remainingSeconds = Math.max(state.preferences.timeDuration - elapsedSeconds, 0);
		const timeLabel =
			state.preferences.defaultMode === 'time'
				? `${remainingSeconds}s`
				: state.preferences.defaultMode === 'zen'
					? state.startedAt
						? formatDuration(elapsedSeconds)
						: '—'
					: getProgressLabel();

		updateStats(metrics, timeLabel);
		upsertMetricSample(metrics, textArea.value);
		renderQuoteText(quoteText, state.quote.text, textArea.value, state.preferences.defaultMode, state.completed);
		syncQuoteViewport();
		syncPreferenceButtons();

		if (metrics.mistakes > state.lastMistakeCount) {
			playTone(state.preferences.soundEnabled, 'error');
			if (state.startedAt) {
				state.errorMoments.push(Math.max(Date.now() - state.startedAt, 250));
			}
		}
		state.lastMistakeCount = metrics.mistakes;

		if (state.preferences.defaultMode === 'time' && elapsedSeconds >= state.preferences.timeDuration) {
			void completeRun('timeout');
			return;
		}

		if (
			state.preferences.defaultMode !== 'zen'
			&& textArea.value.length === state.quote.text.length
			&& textArea.value === state.quote.text
		) {
			void completeRun('completed');
		}
	};

	const startIfNeeded = () => {
		if (state.startedAt || state.completed) {
			return;
		}

		state.startedAt = Date.now();
		if (state.currentBurstStartedAt === null && textArea.value.length > 0) {
			state.currentBurstStartedAt = state.startedAt;
			state.currentBurstStartIndex = 0;
		}
		ensureTimerRunning();
	};

	const loadQuote = async () => {
		setQuoteSwitchingState(true);
		const mode = state.preferences.defaultMode;
		const loadingMessage =
			mode === 'zen'
				? t('home.loadingZen')
				: mode === 'words'
					? t('home.loadingWords', { count: state.wordCount })
					: t('home.loadingQuote');
		let loadingStatusTimer = window.setTimeout(() => {
			setStatus(status, loadingMessage, 'info');
		}, 180);
		textArea.setAttribute('disabled', 'true');

		try {
			if (mode === 'zen') {
				state.quoteSeed = createSyntheticQuote('', null, state.preferences.language, 'short');
				syncDisplayedQuoteFromSeed();
				state.resultQuoteId = null;
				state.resultQuoteSource = null;
				quoteSource.textContent = t('home.zenSource', { language: getLanguageLabel(state.preferences.language) });
			} else if (mode === 'words') {
				state.quoteSeed = await buildWordsModeQuote(state.preferences, state.wordCount);
				syncDisplayedQuoteFromSeed();
				state.resultQuoteId = null;
				state.resultQuoteSource = state.quote.source;
				quoteSource.textContent = `${state.quote.source} • ${getLanguageLabel(state.quote.language)}`;
			} else {
				state.quoteSeed = await getQuoteWithFallback(state.preferences);
				syncDisplayedQuoteFromSeed();
				state.resultQuoteId = state.quote.id;
				state.resultQuoteSource = state.quote.source;
				quoteSource.textContent = state.quote.source
					? `${state.quote.source} • ${getLanguageLabel(state.quote.language)}`
					: t('home.quoteBackendSource', { language: getLanguageLabel(state.quote.language) });
			}
			syncPreferenceLabels();
			resetRun();
			window.clearTimeout(loadingStatusTimer);
			clearStatus(status);
		} catch (error) {
			window.clearTimeout(loadingStatusTimer);
			if (error instanceof ApiError && error.status === 401) {
				handleAuthFailure();
				return;
			}

			setStatus(status, error instanceof Error ? error.message : t('home.error.loadQuote'), 'error');
		} finally {
			window.clearTimeout(loadingStatusTimer);
			window.requestAnimationFrame(() => {
				setQuoteSwitchingState(false);
			});
		}
	};

	const updatePreferences = async (payload: Partial<UserPreferences>) => {
		if (state.isUpdatingPreferences || Object.keys(payload).length === 0) {
			return;
		}

		const previousPreferences = { ...state.preferences };
		state.preferences = {
			...state.preferences,
			...payload
		};
		state.isUpdatingPreferences = true;
		syncPreferenceButtons();
		syncPreferenceLabels();

		try {
			state.preferences = await updateMyPreferences(session, payload);
			applyThemePreference(state.preferences.theme);
			syncDisplayedQuoteFromSeed();
			syncPreferenceLabels();

			if (
				payload.language
				|| payload.defaultMode
				|| payload.timeDuration
				|| (payload.numbersEnabled !== undefined && modeSupportsTextSanitizers())
			) {
				await loadQuote();
			} else if (payload.punctuationEnabled !== undefined || payload.numbersEnabled !== undefined) {
				resetRun();
			}
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) {
				handleAuthFailure();
				return;
			}

			state.preferences = previousPreferences;
			syncPreferenceLabels();
			setStatus(status, error instanceof Error ? error.message : t('home.error.updatePreferences'), 'error');
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

	finishZenButtons.forEach((button) => {
		button.addEventListener('click', () => {
			if (state.preferences.defaultMode !== 'zen' || state.completed || textArea.value.trim().length === 0) {
				return;
			}

			startIfNeeded();
			void completeRun('completed');
		});
	});

	nextQuoteButtons.forEach((button) => {
		button.addEventListener('click', () => {
			hideResultModal();
			void loadQuote();
		});
	});

	closeResultButtons.forEach((button) => {
		button.addEventListener('click', () => {
			hideResultModal();
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
			const prefPatch = button.dataset.prefPatch ? JSON.parse(button.dataset.prefPatch) as Partial<UserPreferences> : null;

			if (prefPatch) {
				const isSamePatch = Object.entries(prefPatch).every(([patchKey, patchValue]) => state.preferences[patchKey as keyof UserPreferences] === patchValue);
				if (isSamePatch) {
					return;
				}

				void updatePreferences(prefPatch);
				return;
			}

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

	configSelects.forEach((select) => {
		select.addEventListener('pointerdown', () => {
			const key = select.dataset.prefSelect as 'timeMode' | 'wordsMode' | undefined;
			if (state.isUpdatingPreferences || !key) {
				return;
			}

			if (key === 'timeMode' && state.preferences.defaultMode !== 'time') {
				const currentDuration = Number(select.value) as UserPreferences['timeDuration'];
				void updatePreferences({ defaultMode: 'time', timeDuration: currentDuration });
				return;
			}

			if (key === 'wordsMode' && state.preferences.defaultMode !== 'words') {
				const currentWordCount = Number(select.value) as WordModeCount;
				if (!WORD_MODE_COUNTS.includes(currentWordCount)) {
					return;
				}

				state.wordCount = currentWordCount;
				syncPreferenceLabels();
				void updatePreferences({ defaultMode: 'words' });
			}
		});

		select.addEventListener('change', () => {
			const key = select.dataset.prefSelect as keyof UserPreferences | 'timeMode' | 'wordsMode' | undefined;
			if (!key) {
				return;
			}

			const rawValue = select.value;
			if (key === 'timeMode') {
				const nextDuration = Number(rawValue) as UserPreferences['timeDuration'];
				const isSameTimeMode = state.preferences.defaultMode === 'time' && state.preferences.timeDuration === nextDuration;
				if (isSameTimeMode) {
					return;
				}

				void updatePreferences({ defaultMode: 'time', timeDuration: nextDuration });
				return;
			}

			if (key === 'wordsMode') {
				const nextWordCount = Number(rawValue) as WordModeCount;
				if (!WORD_MODE_COUNTS.includes(nextWordCount)) {
					return;
				}

				const isSameWordsMode = state.preferences.defaultMode === 'words' && state.wordCount === nextWordCount;
				if (isSameWordsMode) {
					return;
				}

				state.wordCount = nextWordCount;
				syncPreferenceLabels();
				void updatePreferences({ defaultMode: 'words' });
				return;
			}

			const nextValue = rawValue as UserPreferences[keyof UserPreferences];

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

		const previousValue = state.lastInputValue;
		const nextValue = textArea.value;
		if (nextValue.length > previousValue.length) {
			const previousEndsWord = previousValue.length === 0 || /\s$/.test(previousValue);
			if (previousEndsWord) {
				state.currentBurstStartedAt = Date.now();
				state.currentBurstStartIndex = previousValue.length;
			}
		}
		state.lastInputValue = nextValue;

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

		if (
			state.preferences.defaultMode === 'zen'
			&& event.key === 'Enter'
			&& (event.ctrlKey || event.metaKey)
			&& !state.completed
		) {
			event.preventDefault();
			if (textArea.value.trim().length === 0) {
				return;
			}

			startIfNeeded();
			void completeRun('completed');
			return;
		}

		if (event.key === 'Tab' && document.activeElement !== textArea) {
			event.preventDefault();
			textArea.focus();
			return;
		}

		if (event.key === 'Enter' && state.completed) {
			event.preventDefault();
			hideResultModal();
			void loadQuote();
			return;
		}

		if (!state.completed && document.activeElement !== textArea && !event.ctrlKey && !event.metaKey && !event.altKey && isTypingKey) {
			textArea.focus();
		}

		if (!state.quote || state.completed || document.activeElement !== textArea || event.ctrlKey || event.metaKey || event.altKey) {
			return;
		}

		if (event.key.length === 1) {
			state.totalKeyStrokes += 1;
			const expectedCharacter = state.preferences.defaultMode === 'zen'
				? event.key
				: state.quote.text[textArea.value.length] || '';
			if (event.key !== expectedCharacter) {
				state.incorrectKeyStrokes += 1;
			}
		}
	});

	window.addEventListener('resize', () => {
		if (!state.quote) {
			return;
		}

		renderQuoteText(quoteText, state.quote.text, textArea.value, state.preferences.defaultMode, state.completed);
		syncQuoteViewport();
	});

	window.addEventListener('monkeytype:localechange', () => {
		renderHistory(historyList, state.results);
		syncPreferenceLabels();
		if (state.quote) {
			const sourceText = state.preferences.defaultMode === 'zen'
				? t('home.zenSource', { language: getLanguageLabel(state.preferences.language) })
				: state.quote.source
					? `${state.quote.source} • ${getLanguageLabel(state.quote.language)}`
					: t('home.quoteBackendSource', { language: getLanguageLabel(state.quote.language) });
			quoteSource.textContent = sourceText;
		}
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

			await showErrorAlert(error instanceof Error ? error.message : t('home.error.loadExperience'));
		});
}
