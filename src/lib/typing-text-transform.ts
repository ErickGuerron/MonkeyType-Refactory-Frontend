import type { UserPreferences } from './typing-api';

type TypingMode = UserPreferences['defaultMode'];

interface TextTransformPreferences {
	punctuationEnabled: boolean;
	numbersEnabled: boolean;
}

interface ApplyTypingTextTransformPreferences extends TextTransformPreferences {
	language?: string;
	mode?: TypingMode;
	quoteHasNumbers?: boolean;
}

interface DeriveTypingTextInput extends TextTransformPreferences {
	baseText: string;
	language?: string;
	mode: TypingMode;
	quoteHasNumbers?: boolean;
	wordCount?: number;
}

type TextTransform = (text: string) => string;

const NUMBER_WORD_REPLACEMENTS: Record<string, Array<[string, string]>> = {
	english: [
		['zero', '0'],
		['one', '1'],
		['two', '2'],
		['three', '3'],
		['four', '4'],
		['five', '5'],
		['six', '6'],
		['seven', '7'],
		['eight', '8'],
		['nine', '9'],
		['ten', '10'],
		['eleven', '11'],
		['twelve', '12'],
		['thirteen', '13'],
		['fourteen', '14'],
		['fifteen', '15'],
		['sixteen', '16'],
		['seventeen', '17'],
		['eighteen', '18'],
		['nineteen', '19'],
		['twenty', '20']
	],
	spanish: [
		['cero', '0'],
		['uno', '1'],
		['dos', '2'],
		['tres', '3'],
		['cuatro', '4'],
		['cinco', '5'],
		['seis', '6'],
		['siete', '7'],
		['ocho', '8'],
		['nueve', '9'],
		['diez', '10'],
		['once', '11'],
		['doce', '12'],
		['trece', '13'],
		['catorce', '14'],
		['quince', '15'],
		['dieciseis', '16'],
		['dieciséis', '16'],
		['diecisiete', '17'],
		['dieciocho', '18'],
		['diecinueve', '19'],
		['veinte', '20']
	]
};

const ENGLISH_CONTRACTION_EXPANSIONS: Array<[RegExp, string]> = [
	[/\bI'm\b/gu, 'I am'],
	[/\bI've\b/gu, 'I have'],
	[/\bI'll\b/gu, 'I will'],
	[/\bI'd\b/gu, 'I would'],
	[/\byou're\b/giu, 'you are'],
	[/\byou've\b/giu, 'you have'],
	[/\byou'll\b/giu, 'you will'],
	[/\byou'd\b/giu, 'you would'],
	[/\bwe're\b/giu, 'we are'],
	[/\bwe've\b/giu, 'we have'],
	[/\bwe'll\b/giu, 'we will'],
	[/\bwe'd\b/giu, 'we would'],
	[/\bthey're\b/giu, 'they are'],
	[/\bthey've\b/giu, 'they have'],
	[/\bthey'll\b/giu, 'they will'],
	[/\bthey'd\b/giu, 'they would'],
	[/\bhe's\b/giu, 'he is'],
	[/\bhe'll\b/giu, 'he will'],
	[/\bhe'd\b/giu, 'he would'],
	[/\bshe's\b/giu, 'she is'],
	[/\bshe'll\b/giu, 'she will'],
	[/\bshe'd\b/giu, 'she would'],
	[/\bit's\b/giu, 'it is'],
	[/\bit'll\b/giu, 'it will'],
	[/\bit'd\b/giu, 'it would'],
	[/\bthat's\b/giu, 'that is'],
	[/\bthere's\b/giu, 'there is'],
	[/\bhere's\b/giu, 'here is'],
	[/\bwhat's\b/giu, 'what is'],
	[/\bwho's\b/giu, 'who is'],
	[/\bwhere's\b/giu, 'where is'],
	[/\bwhen's\b/giu, 'when is'],
	[/\bwhy's\b/giu, 'why is'],
	[/\bhow's\b/giu, 'how is'],
	[/\blet's\b/giu, 'let us'],
	[/\bcan't\b/giu, 'cannot'],
	[/\bwon't\b/giu, 'will not'],
	[/\bshan't\b/giu, 'shall not'],
	[/\bain't\b/giu, 'is not'],
	[/n['’]t\b/giu, ' not'],
	[/['’]re\b/giu, ' are'],
	[/['’]ve\b/giu, ' have'],
	[/['’]ll\b/giu, ' will'],
	[/['’]d\b/giu, ' would'],
	[/['’]m\b/giu, ' am']
];

function expandEnglishContractions(text: string) {
	return ENGLISH_CONTRACTION_EXPANSIONS.reduce((currentText, [pattern, replacement]) => {
		return currentText.replace(pattern, replacement);
	}, text);
}

function normalizeWordJoiners(text: string) {
	return text
		.replace(/[\u2018\u2019\u0060']/gu, '')
		.replace(/[\u2010-\u2015\-_/]+/gu, ' ');
}

function stripPunctuation(text: string) {
	return normalizeWordJoiners(text).replace(/[\p{P}\p{S}]/gu, '');
}

function stripNumbers(text: string) {
	return text.replace(/\p{N}+/gu, '');
}

function escapeRegex(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceNumberWordsWithDigits(text: string, language?: string) {
	const replacements = language ? NUMBER_WORD_REPLACEMENTS[language.toLowerCase()] : undefined;

	if (!replacements?.length) {
		return text;
	}

	return replacements.reduce((currentText, [token, value]) => {
		const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(token)}(?![\\p{L}\\p{N}])`, 'giu');
		return currentText.replace(pattern, value);
	}, text);
}

function normalizeWhitespace(text: string) {
	return text.replace(/\s+/g, ' ').trim();
}

function createTextTransformPipeline(preferences: TextTransformPreferences & { language?: string; mode: TypingMode; quoteHasNumbers?: boolean }) {
	const pipeline: TextTransform[] = [];
	const shouldConvertNumberWords = preferences.numbersEnabled
		&& (preferences.mode === 'words' || preferences.mode === 'time')
		&& preferences.quoteHasNumbers;

	if (shouldConvertNumberWords) {
		pipeline.push((text) => replaceNumberWordsWithDigits(text, preferences.language));
	}

	if (!preferences.numbersEnabled) {
		pipeline.push(stripNumbers);
	}

	if (!preferences.punctuationEnabled) {
		pipeline.push(stripPunctuation);
	}

	return pipeline;
}

export function sliceTextToWordCount(text: string, wordCount: number) {
	const tokens = text.match(/\S+\s*/g) || [];
	return tokens.slice(0, wordCount).join('').trim();
}

export function countWords(text: string) {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

export function applyTypingTextTransform(text: string, preferences: ApplyTypingTextTransformPreferences) {
	const pipeline = createTextTransformPipeline({
		...preferences,
		mode: preferences.mode ?? 'time',
		quoteHasNumbers: preferences.quoteHasNumbers ?? false
	});
	const transformedText = pipeline.reduce((currentText, transform) => transform(currentText), text);
	return normalizeWhitespace(transformedText);
}

export function deriveTypingText({ baseText, language, mode, punctuationEnabled, numbersEnabled, quoteHasNumbers, wordCount }: DeriveTypingTextInput) {
	if (mode === 'quote' || mode === 'zen' || mode === 'custom') {
		return baseText;
	}

	const normalizedLanguage = language?.toLowerCase();
	const textWithExpandedContractions = !punctuationEnabled && normalizedLanguage === 'english'
		? expandEnglishContractions(baseText)
		: baseText;

	const transformedText = applyTypingTextTransform(textWithExpandedContractions, {
		punctuationEnabled,
		numbersEnabled,
		language: normalizedLanguage,
		mode,
		quoteHasNumbers
	});

	if (mode === 'words' && typeof wordCount === 'number') {
		return sliceTextToWordCount(transformedText, wordCount);
	}

	return transformedText;
}
