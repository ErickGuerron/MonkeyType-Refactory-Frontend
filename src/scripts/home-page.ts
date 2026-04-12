import { ApiError } from '../lib/auth-api';
import { Chart, type ChartConfiguration } from 'chart.js/auto';
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

interface TypingMetrics {
	wpm: number;
	rawWpm: number;
	accuracy: number;
	durationInSeconds: number;
	correctCharacters: number;
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

	if (preferences.defaultMode === 'quote') {
		return 'long';
	}

	return 'short';
}

async function getQuoteWithFallback(
	preferences: UserPreferences,
	preferredLength = getQuoteLengthForMode(preferences)
) {
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

function getPreferredLengthForWordsMode(wordCount: WordModeCount): 'short' | 'medium' | 'long' {
	if (wordCount <= 50) {
		return 'medium';
	}

	return 'long';
}

function sliceTextToWordCount(text: string, wordCount: WordModeCount) {
	const tokens = text.match(/\S+\s*/g) || [];
	return tokens.slice(0, wordCount).join('').trim();
}

function countWords(text: string) {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

function createSyntheticQuote(text: string, source: string | null, language: string, length: TypingQuote['length']): TypingQuote {
	const now = new Date().toISOString();

	return {
		id: `synthetic-${language}-${length}-${Date.now()}`,
		text,
		source,
		language,
		length,
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

	while (countWords(combinedText) < wordCount && attempts < 8) {
		attempts += 1;
		const quote = await getQuoteWithFallback(preferences, preferredLength);
		collectedQuotes.push(quote);
		combinedText = [...new Set(collectedQuotes.map((item) => item.text.trim()).filter(Boolean))].join(' ');
	}

	if (countWords(combinedText) < wordCount) {
		throw new Error(`No se pudo preparar un texto de ${wordCount} palabras con la seed disponible.`);
	}

	const text = sliceTextToWordCount(combinedText, wordCount);
	const language = collectedQuotes[0]?.language || preferences.language;
	const source = `Words seed mix • ${wordCount} words`;

	return createSyntheticQuote(text, source, language, preferredLength);
}

function getModeLabel(mode: UserPreferences['defaultMode']) {
	const labels: Record<UserPreferences['defaultMode'], string> = {
		time: 'Time',
		words: 'Words',
		quote: 'Quote',
		zen: 'Zen',
		custom: 'Custom'
	};

	return labels[mode] || mode;
}

function getModeDisplayLabel(preferences: UserPreferences, wordCount: WordModeCount) {
	if (preferences.defaultMode === 'time') {
		return `${getModeLabel(preferences.defaultMode)} ${preferences.timeDuration}s`;
	}

	if (preferences.defaultMode === 'words') {
		return `${getModeLabel(preferences.defaultMode)} ${wordCount}`;
	}

	return getModeLabel(preferences.defaultMode);
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

function computeMetrics(
	input: string,
	target: string,
	startedAt: number | null,
	totalKeyStrokes = input.length,
	incorrectKeyStrokes = Math.max(input.length - target.split('').filter((character, index) => input[index] === character).length, 0)
): TypingMetrics {
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
		startedAt ? Math.ceil((Date.now() - startedAt) / 1000) : 1
	);
	const durationInMinutes = durationInSeconds / 60;
	const rawWpm = typedCharacters === 0 ? 0 : typedCharacters / 5 / durationInMinutes;
	const wpm = correctCharacters === 0 ? 0 : correctCharacters / 5 / durationInMinutes;
	const normalizedTotalKeyStrokes = Math.max(totalKeyStrokes, typedCharacters, 1);
	const normalizedIncorrectKeyStrokes = Math.max(0, Math.min(incorrectKeyStrokes, normalizedTotalKeyStrokes));
	const accuracy = ((normalizedTotalKeyStrokes - normalizedIncorrectKeyStrokes) / normalizedTotalKeyStrokes) * 100;

	return {
		wpm: roundMetric(wpm),
		rawWpm: roundMetric(rawWpm),
		accuracy: roundMetric(accuracy),
		durationInSeconds,
		correctCharacters,
		typedCharacters,
		mistakes: normalizedIncorrectKeyStrokes,
		totalKeyStrokes: normalizedTotalKeyStrokes,
		incorrectKeyStrokes: normalizedIncorrectKeyStrokes
	};
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
	const typingHint = page.querySelector<HTMLElement>('[data-typing-hint]');
	const userName = page.querySelector<HTMLElement>('[data-home-user-name]');
	const userEmail = page.querySelector<HTMLElement>('[data-home-user-email]');
	const logoutButton = page.querySelector<HTMLButtonElement>('[data-action="logout"]');
	const configButtons = Array.from(page.querySelectorAll<HTMLButtonElement>('[data-pref-key]'));
	const configSelects = Array.from(page.querySelectorAll<HTMLSelectElement>('[data-pref-select]'));
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
	const wordCountGroup = page.querySelector<HTMLElement>('[data-words-config]');
	const wordCountButtons = Array.from(page.querySelectorAll<HTMLButtonElement>('[data-word-count]'));
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
	const state = {
		preferences: { ...DEFAULT_PREFERENCES } as UserPreferences,
		quote: null as TypingQuote | null,
		wordCount: DEFAULT_WORD_MODE_COUNT,
		resultQuoteId: null as string | null,
		resultQuoteSource: null as string | null,
		results: [] as TypingResult[],
		startedAt: null as number | null,
		completed: false,
		lastMistakeCount: 0,
		metricSamples: [] as MetricSample[],
		errorMoments: [] as number[],
		totalKeyStrokes: 0,
		incorrectKeyStrokes: 0,
		timerId: 0 as number | undefined,
		isUpdatingPreferences: false
	};

	const upsertMetricSample = (metrics: TypingMetrics) => {
		if (!state.startedAt) {
			return;
		}

		const elapsedMs = Math.max(Date.now() - state.startedAt, 250);
		const bucketMs = 250;
		const bucketKey = Math.floor(elapsedMs / bucketMs);
		const lastSample = state.metricSamples[state.metricSamples.length - 1];
		const rollingBaseline = [...state.metricSamples].reverse().find((sample) => sample.elapsedMs <= elapsedMs - 1000);
		const burstBaseline = lastSample;

		const baselineForWpm = rollingBaseline || state.metricSamples[0];
		const baselineForBurst = burstBaseline || lastSample || state.metricSamples[0];

		const rollingDeltaSeconds = Math.max((elapsedMs - (baselineForWpm?.elapsedMs || 0)) / 1000, 0.25);
		const burstDeltaSeconds = Math.max((elapsedMs - (baselineForBurst?.elapsedMs || 0)) / 1000, 0.12);
		const rollingTypedCharacters = Math.max(metrics.typedCharacters - (baselineForWpm?.typedCharactersAtSample || 0), 0);
		const rollingCorrectCharacters = Math.max(metrics.correctCharacters - (baselineForWpm?.correctCharactersAtSample || 0), 0);
		const burstTypedCharacters = Math.max(metrics.typedCharacters - (baselineForBurst?.typedCharactersAtSample || 0), 0);

		const instantaneousRawWpm = roundMetric((rollingTypedCharacters / 5) / (rollingDeltaSeconds / 60));
		const instantaneousWpm = roundMetric((rollingCorrectCharacters / 5) / (rollingDeltaSeconds / 60));
		const burstWpm = roundMetric((burstTypedCharacters / 5) / (burstDeltaSeconds / 60));

		const sample: MetricSample = {
			elapsedMs,
			wpm: instantaneousWpm,
			rawWpm: instantaneousRawWpm,
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
			burstWpm: metrics.rawWpm,
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
							borderColor: 'rgba(255, 255, 255, 0.95)',
							backgroundColor: 'rgba(255, 255, 255, 0.14)',
							borderWidth: 2.2,
							borderDash: [8, 6],
							pointRadius: 1.6,
							pointHoverRadius: 4,
							pointBackgroundColor: 'rgba(255, 255, 255, 0.95)',
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
						backgroundColor: 'rgba(17, 17, 17, 0.92)',
						borderColor: 'rgba(241, 235, 223, 0.12)',
						borderWidth: 1,
						titleColor: '#f1ebdf',
						bodyColor: 'rgba(241, 235, 223, 0.88)',
						padding: 10,
						callbacks: {
							title(items) {
								const value = items[0]?.parsed.x ?? 0;
								return `${roundMetric(value)}s`;
							},
							label(item) {
								if (item.dataset.label === 'ERRORS') {
									return 'Error';
								}

								return `${item.dataset.label}: ${formatMetric(item.parsed.y)} WPM`;
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
							color: 'rgba(241, 235, 223, 0.08)'
						},
						border: {
							color: 'rgba(241, 235, 223, 0.12)'
						},
						ticks: {
							color: 'rgba(241, 235, 223, 0.72)',
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
							text: 'time',
							color: 'rgba(241, 235, 223, 0.72)',
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
							color: 'rgba(241, 235, 223, 0.08)'
						},
						border: {
							color: 'rgba(241, 235, 223, 0.12)'
						},
						ticks: {
							color: 'rgba(241, 235, 223, 0.72)',
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
							text: 'wpm',
							color: 'rgba(241, 235, 223, 0.72)',
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
			button.disabled = state.isUpdatingPreferences;
		});

		configSelects.forEach((select) => {
			const key = select.dataset.prefSelect as keyof UserPreferences | undefined;
			if (!key) {
				return;
			}

			if (key === 'timeMode') {
				select.value = String(state.preferences.timeDuration);
				select.disabled = state.isUpdatingPreferences;
				return;
			}

			select.value = String(state.preferences[key]);
			select.disabled = state.isUpdatingPreferences;
		});

		wordCountGroup?.toggleAttribute('hidden', state.preferences.defaultMode !== 'words');
		wordCountButtons.forEach((button) => {
			button.classList.toggle('is-active', Number(button.dataset.wordCount) === state.wordCount);
			button.disabled = state.isUpdatingPreferences || state.preferences.defaultMode !== 'words';
		});
		finishZenButtons.forEach((button) => {
			button.hidden = state.preferences.defaultMode !== 'zen';
		});
	};

	const syncPreferenceLabels = () => {
		statMode.textContent = getModeDisplayLabel(state.preferences, state.wordCount);
		statTimerLabel.textContent = state.preferences.defaultMode === 'time' ? 'time' : 'elapsed';
		statLanguage.textContent = getLanguageLabel(state.quote?.language || state.preferences.language);
		typingHint.textContent = state.preferences.defaultMode === 'zen'
			? 'write freely — ctrl+enter or finish zen when you want to save the run'
			: state.preferences.defaultMode === 'words'
				? `type the ${state.wordCount}-word target until completion`
				: 'type directly over the quote and keep your focus in the line';
		liveWpmCard.hidden = !state.preferences.showLiveWpm;
		syncPreferenceButtons();
	};

	const getInitialTimerLabel = () => (state.preferences.defaultMode === 'time' ? `${state.preferences.timeDuration}s` : '—');

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
		updateStats(computeMetrics('', state.preferences.defaultMode === 'zen' ? '' : state.quote?.text || '', null, 0, 0), initialTimerLabel);
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
			state.incorrectKeyStrokes
		);
		upsertMetricSample(metrics);
		updateStats(metrics, formatDuration(metrics.durationInSeconds));
		playTone(state.preferences.soundEnabled, 'success');

		showResultModal();
		resultTitle.textContent = reason === 'timeout' ? 'Tiempo cumplido' : 'Test completado';
		resultSummary.textContent = `${formatMetric(metrics.wpm)} WPM • ${formatPercentage(metrics.accuracy)} accuracy • ${metrics.mistakes} errores`;
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

		const metricsTarget = state.preferences.defaultMode === 'zen' ? textArea.value : state.quote.text;
		const metrics = computeMetrics(
			textArea.value,
			metricsTarget,
			state.startedAt,
			state.totalKeyStrokes,
			state.incorrectKeyStrokes
		);
		const elapsedSeconds = state.startedAt ? Math.ceil((Date.now() - state.startedAt) / 1000) : 0;
		const remainingSeconds = Math.max(state.preferences.timeDuration - elapsedSeconds, 0);
		const timeLabel =
			state.preferences.defaultMode === 'time'
				? `${remainingSeconds}s`
				: state.startedAt
					? formatDuration(elapsedSeconds)
					: '—';

		updateStats(metrics, timeLabel);
		renderQuoteText(quoteText, state.quote.text, textArea.value, state.preferences.defaultMode, state.completed);
		syncQuoteViewport();

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
		ensureTimerRunning();
	};

	const loadQuote = async () => {
		setQuoteSwitchingState(true);
		const mode = state.preferences.defaultMode;
		const loadingMessage =
			mode === 'zen'
				? 'Preparando zen mode...'
				: mode === 'words'
					? `Preparando words ${state.wordCount}...`
					: 'Cargando quote desde el backend...';
		setStatus(status, loadingMessage, 'info');
		textArea.setAttribute('disabled', 'true');

		try {
			if (mode === 'zen') {
				state.quote = createSyntheticQuote('', null, state.preferences.language, 'short');
				state.resultQuoteId = null;
				state.resultQuoteSource = null;
				quoteSource.textContent = `Zen mode • ${getLanguageLabel(state.preferences.language)} • Ctrl+Enter para terminar`;
			} else if (mode === 'words') {
				state.quote = await buildWordsModeQuote(state.preferences, state.wordCount);
				state.resultQuoteId = null;
				state.resultQuoteSource = state.quote.source;
				quoteSource.textContent = `${state.quote.source} • ${getLanguageLabel(state.quote.language)}`;
			} else {
				state.quote = await getQuoteWithFallback(state.preferences);
				state.resultQuoteId = state.quote.id;
				state.resultQuoteSource = state.quote.source;
				quoteSource.textContent = state.quote.source
					? `${state.quote.source} • ${getLanguageLabel(state.quote.language)}`
					: `Quote backend • ${getLanguageLabel(state.quote.language)}`;
			}
			syncPreferenceLabels();
			resetRun();
			clearStatus(status);
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) {
				handleAuthFailure();
				return;
			}

			setStatus(status, error instanceof Error ? error.message : 'No se pudo obtener una quote.', 'error');
		} finally {
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
			syncPreferenceLabels();

			if (payload.language || payload.defaultMode || payload.timeDuration) {
				await loadQuote();
			}
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) {
				handleAuthFailure();
				return;
			}

			state.preferences = previousPreferences;
			syncPreferenceLabels();
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

	wordCountButtons.forEach((button) => {
		button.addEventListener('click', () => {
			const nextWordCount = Number(button.dataset.wordCount) as WordModeCount;
			if (!WORD_MODE_COUNTS.includes(nextWordCount) || state.wordCount === nextWordCount) {
				return;
			}

			state.wordCount = nextWordCount;
			syncPreferenceLabels();
			void loadQuote();
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
		select.addEventListener('change', () => {
			const key = select.dataset.prefSelect as keyof UserPreferences | 'timeMode' | undefined;
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
