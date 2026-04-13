export type UiLocale = 'en' | 'es';

type TranslationDictionary = Record<string, string>;

const UI_LOCALE_STORAGE_KEY = 'monkeytype.ui-locale';

const translations: Record<UiLocale, TranslationDictionary> = {
	en: {
		'locale.en': 'English',
		'locale.es': 'Spanish',
		'meta.defaultDescription': 'MonkeyType typing experience with account access and settings.',
		'brand.tagline': 'focused typing flow',
		'nav.home': 'Home',
		'nav.login': 'Login',
		'nav.register': 'Register',
		'nav.typing': 'typing',
		'nav.settings': 'settings',
		'nav.hint': 'monkey see monkey type',
		'nav.uiLanguage': 'UI language',
		'footer.privateCopy': 'Minimal typing in Astro, connected to real quotes, results, and preferences.',
		'footer.publicCopy': 'A dark, sober experience ready to let you sign in, practice, and tune your writing space.',
		'footer.settings': 'Settings',
		'footer.apiDocs': 'API docs',
		'footer.health': 'Health',
		'landing.title': 'MonkeyType | Landing',
		'landing.description': 'MonkeyType to write with focus, access your account, and keep your rhythm.',
		'landing.eyebrow': 'Typing focus',
		'landing.heroTitle': 'Write with rhythm, measure your progress, and keep your account ready.',
		'landing.heroBody': 'MonkeyType welcomes you with a minimal, dark, and direct experience: sign in, practice, return to your space, and tune how each session should feel.',
		'landing.ctaRegister': 'Create account',
		'landing.ctaLogin': 'Sign in',
		'landing.ctaPrivate': 'Go to my space',
		'landing.journeyTitle': 'Your journey',
		'landing.journey1': 'Public landing page to discover the experience.',
		'landing.journey2': 'Login and register to access your account.',
		'landing.journey3': 'Private home to resume your session.',
		'landing.journey4': 'Settings to tune your style.',
		'landing.findTitle': 'What you get',
		'landing.findBody': 'A warm terminal aesthetic, strong visual focus, and a flow designed to get you back to typing fast.',
		'landing.accountTitle': 'Account and settings',
		'landing.accountBody': 'Once inside, you get a private home and a settings screen with sections for behavior, appearance, and general preferences.',
		'auth.fieldName': 'Name',
		'auth.fieldEmail': 'Email',
		'auth.fieldPassword': 'Password',
		'auth.fieldConfirmPassword': 'Confirm password',
		'auth.login.title': 'MonkeyType | Login',
		'auth.login.descriptionMeta': 'Sign in to MonkeyType.',
		'auth.login.heading': 'Sign in',
		'auth.login.body': 'Enter with your email and password.',
		'auth.login.submit': 'Sign in',
		'auth.login.createAccount': 'Create account',
		'auth.login.forgotPassword': 'Forgot my password',
		'auth.register.title': 'MonkeyType | Register',
		'auth.register.descriptionMeta': 'Create your account in MonkeyType.',
		'auth.register.heading': 'Create account',
		'auth.register.body': 'Complete the fields to register.',
		'auth.register.submit': 'Create account',
		'auth.register.haveAccount': 'I already have an account',
		'auth.register.needRecovery': 'I need to recover access',
		'auth.reset.title': 'MonkeyType | Reset password',
		'auth.reset.descriptionMeta': 'Recover access to your account.',
		'auth.reset.heading': 'Recover access',
		'auth.reset.body': 'Enter your email to continue.',
		'auth.reset.submit': 'Send recovery link',
		'auth.reset.note': 'We will send you a link to set a new password without exposing whether the email exists or not.',
		'auth.reset.backToLogin': 'Back to login',
		'auth.reset.newAccount': 'Create a new account',
		'auth.resetConfirm.title': 'MonkeyType | New password',
		'auth.resetConfirm.descriptionMeta': 'Set a new password for your account.',
		'auth.resetConfirm.heading': 'Choose a new password',
		'auth.resetConfirm.body': 'Use the link from your email to complete the change.',
		'auth.resetConfirm.submit': 'Save new password',
		'auth.resetConfirm.note': 'If the link expired, request a new one from the recovery screen.',
		'auth.resetConfirm.requestAnother': 'Request another link',
		'auth.form.placeholderEmail': 'name@monkeytype.dev',
		'layout.privateArea': 'Private area',
		'home.title': 'MonkeyType | Home',
		'home.descriptionMeta': 'Main typing test connected to real quotes, results, and preferences.',
		'home.pageEyebrow': 'Typing',
		'home.pageTitle': 'Writing becomes the center again.',
		'home.pageDescription': 'Your private home now starts a real quote, respects backend preferences, and stores results without breaking the current integration.',
		'home.quickConfigAria': 'Quick configuration',
		'home.mode': 'mode',
		'home.mode.time30': 'time 30',
		'home.mode.time60': 'time 60',
		'home.mode.time120': 'time 120',
		'home.mode.quote': 'quote',
		'home.mode.words50': 'words 50',
		'home.mode.words100': 'words 100',
		'home.mode.words150': 'words 150',
		'home.mode.zen': 'zen',
		'home.quoteLanguage': 'quote language',
		'home.signals': 'signals',
		'home.liveWpm': 'live wpm',
		'home.punctuation': 'punctuation',
		'home.numbers': 'numbers',
		'home.sound': 'sound',
		'home.settings': 'settings',
		'home.typingStageAria': 'Main typing test',
		'home.time': 'time',
		'home.live': 'live',
		'home.typingSurfaceAria': 'Main typing input',
		'home.typingHelpAria': 'Typing helper',
		'home.typingHint': 'type directly over the quote and keep your focus in the line',
		'home.typingHintZen': 'write freely — ctrl+enter or finish zen when you want to save the run',
		'home.typingHintWords': 'type the {count}-word target until completion',
		'home.elapsed': 'elapsed',
		'home.words': 'words',
		'home.raw': 'raw',
		'home.acc': 'acc',
		'home.restart': 'restart',
		'home.next': 'next',
		'home.focus': 'focus',
		'home.finishZen': 'finish zen',
		'home.resultEyebrow': 'test completed',
		'home.resultSaved': 'Result saved',
		'home.wpm': 'wpm',
		'home.runGraph': 'run graph',
		'home.burst': 'burst',
		'home.errors': 'errors',
		'home.language': 'language',
		'home.close': 'close',
		'home.nextTest': 'next test',
		'home.profile': 'profile',
		'home.logout': 'logout',
		'home.railCopy': 'The home puts writing back at the center while keeping quotes, results, and preferences connected to the current backend.',
		'home.recentResults': 'recent results',
		'home.history': 'history',
		'home.preferences': 'preferences',
		'home.shortcutsAria': 'Visual shortcuts',
		'home.shortcutRestart': 'restart',
		'home.shortcutFocus': 'focus input',
		'home.shortcutNext': 'next test after result',
		'home.shortcutFinishZen': 'finish zen',
		'home.selectTimeModeAria': 'Select time mode',
		'home.selectWordsModeAria': 'Select words mode',
		'home.selectQuoteLanguageAria': 'Select quote language',
		'home.resultChartAria': 'Result chart',
		'home.historyEmpty': 'You have not saved results yet. Your next run will start the history.',
		'home.resultTimeout': 'Time is up',
		'home.resultCompleted': 'Test completed',
		'home.resultSummary': '{wpm} WPM • {accuracy} • {errors} errors',
		'home.toastSavedTitle': 'Result saved',
		'home.toastSavedBody': 'Your run is already in the history.',
		'home.error.saveResult': 'The result could not be saved.',
		'home.error.loadQuote': 'The quote could not be loaded.',
		'home.error.quoteUnavailable': 'A quote could not be obtained.',
		'home.error.wordsSeedUnavailable': 'A {count}-word text could not be prepared with the available seed.',
		'home.error.updatePreferences': 'Preferences could not be updated.',
		'home.error.loadExperience': 'The typing experience could not be loaded.',
		'home.loadingZen': 'Preparing zen mode...',
		'home.loadingWords': 'Preparing words {count}...',
		'home.loadingQuote': 'Loading quote from backend...',
		'home.zenSource': 'Zen mode • {language} • Ctrl+Enter to finish',
		'home.quoteBackendSource': 'Backend quote • {language}',
		'home.chart.tooltipError': 'Error',
		'home.chart.tooltipSeries': '{label}: {value} WPM',
		'home.chart.timeAxis': 'time',
		'home.chart.wpmAxis': 'wpm',
		'home.mode.timeDisplay': 'Time {duration}s',
		'home.mode.wordsDisplay': 'Words {count}',
		'home.mode.quoteDisplay': 'Quote',
		'home.mode.zenDisplay': 'Zen',
		'home.mode.customDisplay': 'Custom',
		'settings.title': 'MonkeyType | Settings',
		'settings.descriptionMeta': 'Private MonkeyType settings connected to real backend preferences.',
		'settings.pageEyebrow': 'Settings',
		'settings.pageTitle': 'Tune the experience until it feels yours.',
		'settings.pageDescription': 'The visual structure stays deep and organized, but now theme, quote language, default mode, time duration, live WPM, punctuation, numbers, and sound are read from and persisted to the real API.',
		'settings.profile': 'Profile',
		'settings.logout': 'Log out',
		'settings.experience': 'Experience',
		'settings.core': 'Core',
		'settings.experienceBody': 'The essentials so the typing home arrives ready: theme, quote language, and default mode.',
		'settings.uiLanguage': 'UI language',
		'settings.uiLanguageAria': 'UI language selector',
		'settings.uiLanguageBody': 'Changes the language of the whole page interface without affecting the quote language.',
		'settings.theme': 'Theme',
		'settings.quoteLanguage': 'Quote language',
		'settings.defaultMode': 'Default mode',
		'settings.timeDuration': 'Time duration',
		'settings.liveFeedback': 'Live feedback',
		'settings.runtime': 'Runtime',
		'settings.liveFeedbackBody': 'Control how much signal appears while you type and whether you want subtle audio for error/success.',
		'settings.showLiveWpm': 'Show live WPM',
		'settings.showLiveWpmBody': 'Show or hide the live metric on the main screen.',
		'settings.punctuationEnabled': 'Punctuation enabled',
		'settings.punctuationEnabledBody': 'In words/time it keeps punctuation; in quote it always preserves the natural text.',
		'settings.numbersEnabled': 'Numbers enabled',
		'settings.numbersEnabledBody': 'In words/time it keeps numbers; when off it derives text from the original quote without digits.',
		'settings.soundEnabled': 'Sound enabled',
		'settings.soundEnabledBody': 'Enable subtle tones for errors and test completion.',
		'settings.preview': 'Preview',
		'settings.now': 'Now',
		'settings.previewBullet1': 'Home uses quote language + default mode + time duration to choose a quote, base duration, or build words 50/100/150.',
		'settings.previewBullet2': 'Words and time derive the text from the original quote applying punctuation and numbers filters.',
		'settings.previewBullet3': 'Theme is applied live on the current layout.',
		'settings.previewBullet4': 'Zen stores stats/results, but does not persist free text as a quote in Mongo.',
		'settings.previewBullet5': 'Changes are saved with a real PATCH to /api/users/me/preferences.',
		'settings.dangerTitle': 'Danger zone',
		'settings.session': 'Session',
		'settings.dangerBody': 'We keep a sensitive zone, but without smoke: you can discard local changes or log out from the current device.',
		'settings.discardChanges': 'Discard changes',
		'settings.savePreferences': 'Save preferences',
		'settings.theme.system': 'System',
		'settings.theme.dark': 'Dark',
		'settings.theme.light': 'Light',
		'settings.language.english': 'English',
		'settings.language.spanish': 'Spanish',
		'settings.mode.time': 'Time (configurable duration)',
		'settings.mode.quote': 'Quote complete',
		'settings.mode.words': 'Words (50 / 100 / 150 on home)',
		'settings.mode.zen': 'Zen (free writing)',
		'settings.mode.custom': 'Custom',
		'settings.time.30': '30 seconds',
		'settings.time.60': '60 seconds',
		'settings.time.120': '120 seconds',
		'settings.summary': 'Theme {theme} • {language} • {mode} • live WPM {liveWpm} • punctuation {punctuation} • numbers {numbers} • sound {sound}',
		'settings.summary.mode.time': 'time {duration}s',
		'settings.summary.mode.words': 'words 50/100/150 on home',
		'common.on': 'on',
		'common.off': 'off',
		'common.accuracy': 'accuracy',
		'settings.toast.noChangesTitle': 'No changes',
		'settings.toast.noChangesText': 'There are no new preferences to save.',
		'settings.status.saving': 'Saving real preferences to the backend...',
		'settings.status.updated': 'Preferences updated successfully.',
		'settings.toast.savedTitle': 'Preferences saved',
		'settings.toast.savedText': 'Your settings are already persisted in the backend.',
		'settings.status.loading': 'Loading preferences...',
		'settings.error.save': 'Preferences could not be saved.',
		'settings.error.load': 'Preferences could not be loaded.',
		'app.redirectTitle': 'MonkeyType | Redirecting',
		'app.redirectDescription': 'Internal redirect to the new main private route.',
		'app.redirectBody': 'Redirecting to your new private home...',
		'alerts.ok': 'Got it',
		'alerts.retry': 'Retry',
		'alerts.okShort': 'Ok',
		'alerts.errorTitle': 'Action could not be completed',
		'auth.validation.enterEmail': 'Enter your email to continue with recovery.',
		'auth.reset.checkEmailTitle': 'Check your email',
		'auth.reset.checkEmailBody': 'If the email exists in MonkeyType, we already sent the recovery link.',
		'auth.validation.missingToken': 'The recovery token is missing from the link.',
		'auth.validation.enterNewPassword': 'Enter your new password.',
		'auth.validation.passwordMismatch': 'Passwords do not match.',
		'auth.reset.updatedTitle': 'Password updated',
		'auth.reset.updatedBody': 'You can now sign in with your new password.',
		'auth.reset.invalidLinkTitle': 'Invalid or expired link',
		'auth.reset.invalidLinkBody': 'Request a new recovery link to keep going.',
		'auth.validation.completeRequired': 'Complete the required fields.',
		'auth.validation.enterVisibleName': 'Enter a visible name for your account.',
		'auth.toast.loginSuccessTitle': 'Login successful',
		'auth.toast.loginSuccessBody': 'Redirecting to your dashboard.',
		'auth.toast.registerSuccessTitle': 'Account created',
		'auth.toast.registerSuccessBody': 'Welcome to MonkeyType.',
		'auth.unexpectedError': 'An unexpected error occurred.',
		'auth.reset.incompleteLinkTitle': 'Incomplete link',
		'auth.reset.incompleteLinkBody': 'Open the full email link to change your password.',
		'auth.session.storedToken': 'Token stored locally • {timestamp}',
		'auth.session.validating': 'Validating session against /api/auth/me...',
		'auth.session.validated': 'Session validated successfully against the backend.',
		'auth.session.redirectingLogin': '{message} Redirecting to login...',
		'auth.session.expiredRedirecting': 'Session expired. Redirecting to login...',
		'apiErrors.INVALID_EMAIL': 'Enter a valid email to continue.',
		'apiErrors.INVALID_PASSWORD': 'Password must be at least 8 characters long.',
		'apiErrors.INVALID_NAME': 'Enter a valid visible name.',
		'apiErrors.INVALID_CREDENTIALS': 'Invalid credentials.',
		'apiErrors.EMAIL_ALREADY_REGISTERED': 'There is already an account registered with that email.',
		'apiErrors.INVALID_RESET_TOKEN': 'The recovery link is invalid or is no longer available.',
		'apiErrors.EXPIRED_RESET_TOKEN': 'The recovery link expired. Request a new one.',
		'apiErrors.AUTH_TOKEN_REQUIRED': 'Authentication is required to continue.',
		'apiErrors.AUTH_TOKEN_INVALID': 'Your session is invalid or expired.',
		'apiErrors.AUTH_USER_NOT_FOUND': 'The authenticated user could not be found.',
		'apiErrors.NOT_FOUND': 'The requested resource was not found.',
		'apiErrors.INTERNAL_SERVER_ERROR': 'An internal server error occurred.'
	},
	'es': {
		'locale.en': 'inglés',
		'locale.es': 'español',
		'meta.defaultDescription': 'Experiencia de tipeo MonkeyType con acceso a cuenta y configuración.',
		'brand.tagline': 'flujo de tipeo enfocado',
		'nav.home': 'inicio',
		'nav.login': 'login',
		'nav.register': 'registro',
		'nav.typing': 'typing',
		'nav.settings': 'configuración',
		'nav.hint': 'monkey see monkey type',
		'nav.uiLanguage': 'idioma UI',
		'footer.privateCopy': 'Tipeo minimalista en Astro, conectado a quotes, resultados y preferencias reales.',
		'footer.publicCopy': 'Una experiencia oscura, sobria y lista para entrar, practicar y ajustar tu espacio de escritura.',
		'footer.settings': 'configuración',
		'footer.apiDocs': 'docs API',
		'footer.health': 'salud',
		'landing.title': 'MonkeyType | Inicio',
		'landing.description': 'MonkeyType para escribir con foco, entrar a tu cuenta y seguir tu ritmo.',
		'landing.eyebrow': 'foco al tipear',
		'landing.heroTitle': 'Escribí con ritmo, medí tu progreso y dejá tu cuenta siempre lista.',
		'landing.heroBody': 'MonkeyType te recibe con una experiencia minimal, oscura y directa al punto: entrar, practicar, volver a tu espacio y ajustar cómo querés sentir cada sesión.',
		'landing.ctaRegister': 'crear cuenta',
		'landing.ctaLogin': 'entrar',
		'landing.ctaPrivate': 'ir a mi espacio',
		'landing.journeyTitle': 'tu recorrido',
		'landing.journey1': 'Landing pública para descubrir la experiencia.',
		'landing.journey2': 'Login y registro para entrar a tu cuenta.',
		'landing.journey3': 'Home privada para retomar tu sesión.',
		'landing.journey4': 'Configuración para ajustar tu estilo.',
		'landing.findTitle': 'qué encontrás',
		'landing.findBody': 'Una estética terminal cálida, foco visual alto y un flujo pensado para volver rápido a escribir.',
		'landing.accountTitle': 'cuenta y ajustes',
		'landing.accountBody': 'Una vez adentro tenés un home privado y una pantalla de configuración con secciones para comportamiento, apariencia y preferencias generales.',
		'auth.fieldName': 'nombre',
		'auth.fieldEmail': 'email',
		'auth.fieldPassword': 'contraseña',
		'auth.fieldConfirmPassword': 'confirmar contraseña',
		'auth.login.title': 'MonkeyType | Login',
		'auth.login.descriptionMeta': 'Ingresá a MonkeyType.',
		'auth.login.heading': 'iniciar sesión',
		'auth.login.body': 'Entrá con tu email y contraseña.',
		'auth.login.submit': 'iniciar sesión',
		'auth.login.createAccount': 'crear cuenta',
		'auth.login.forgotPassword': 'olvidé mi contraseña',
		'auth.register.title': 'MonkeyType | Registro',
		'auth.register.descriptionMeta': 'Creá tu cuenta en MonkeyType.',
		'auth.register.heading': 'crear cuenta',
		'auth.register.body': 'Completá los datos para registrarte.',
		'auth.register.submit': 'crear cuenta',
		'auth.register.haveAccount': 'ya tengo cuenta',
		'auth.register.needRecovery': 'necesito recuperar acceso',
		'auth.reset.title': 'MonkeyType | Recuperar contraseña',
		'auth.reset.descriptionMeta': 'Recuperá el acceso a tu cuenta.',
		'auth.reset.heading': 'recuperar acceso',
		'auth.reset.body': 'Ingresá tu email para continuar.',
		'auth.reset.submit': 'enviar enlace de recuperación',
		'auth.reset.note': 'Te vamos a enviar un link para definir una nueva contraseña sin exponer si el email existe o no.',
		'auth.reset.backToLogin': 'volver a login',
		'auth.reset.newAccount': 'crear una cuenta nueva',
		'auth.resetConfirm.title': 'MonkeyType | Nueva contraseña',
		'auth.resetConfirm.descriptionMeta': 'Definí una nueva contraseña para tu cuenta.',
		'auth.resetConfirm.heading': 'elegí una nueva contraseña',
		'auth.resetConfirm.body': 'Usá el enlace que llegó por email para completar el cambio.',
		'auth.resetConfirm.submit': 'guardar nueva contraseña',
		'auth.resetConfirm.note': 'Si el enlace expiró, pedí uno nuevo desde la pantalla de recuperación.',
		'auth.resetConfirm.requestAnother': 'solicitar otro enlace',
		'auth.form.placeholderEmail': 'nombre@monkeytype.dev',
		'layout.privateArea': 'área privada',
		'home.title': 'MonkeyType | Home',
		'home.descriptionMeta': 'Test principal de tipeo conectado a quotes, resultados y preferencias reales.',
		'home.pageEyebrow': 'typing',
		'home.pageTitle': 'Escribir vuelve a ser el centro.',
		'home.pageDescription': 'Tu home privada ahora arranca una quote real, respeta preferencias del backend y guarda resultados sin romper la integración actual.',
		'home.quickConfigAria': 'configuración rápida',
		'home.mode': 'modo',
		'home.mode.time30': 'tiempo 30',
		'home.mode.time60': 'tiempo 60',
		'home.mode.time120': 'tiempo 120',
		'home.mode.quote': 'quote',
		'home.mode.words50': 'palabras 50',
		'home.mode.words100': 'palabras 100',
		'home.mode.words150': 'palabras 150',
		'home.mode.zen': 'zen',
		'home.quoteLanguage': 'idioma quote',
		'home.signals': 'señales',
		'home.liveWpm': 'wpm vivo',
		'home.punctuation': 'puntuación',
		'home.numbers': 'números',
		'home.sound': 'sonido',
		'home.settings': 'configuración',
		'home.typingStageAria': 'test principal de typing',
		'home.time': 'tiempo',
		'home.live': 'vivo',
		'home.typingSurfaceAria': 'entrada principal de typing',
		'home.typingHelpAria': 'ayuda visual de typing',
		'home.typingHint': 'escribí directamente sobre la quote y mantené el foco en la línea',
		'home.typingHintZen': 'escribí libremente — ctrl+enter o terminar zen cuando quieras guardar la corrida',
		'home.typingHintWords': 'tipeá el objetivo de {count} palabras hasta completarlo',
		'home.elapsed': 'transcurrido',
		'home.words': 'palabras',
		'home.raw': 'raw',
		'home.acc': 'acc',
		'home.restart': 'reiniciar',
		'home.next': 'siguiente',
		'home.focus': 'foco',
		'home.finishZen': 'terminar zen',
		'home.resultEyebrow': 'test completado',
		'home.resultSaved': 'resultado guardado',
		'home.wpm': 'wpm',
		'home.runGraph': 'gráfico de corrida',
		'home.burst': 'burst',
		'home.errors': 'errores',
		'home.language': 'idioma',
		'home.close': 'cerrar',
		'home.nextTest': 'siguiente test',
		'home.profile': 'perfil',
		'home.logout': 'cerrar sesión',
		'home.railCopy': 'La home vuelve a poner la escritura al centro, pero mantiene quotes, resultados y preferencias conectados al backend actual.',
		'home.recentResults': 'resultados recientes',
		'home.history': 'historial',
		'home.preferences': 'preferencias',
		'home.shortcutsAria': 'atajos visuales',
		'home.shortcutRestart': 'reiniciar',
		'home.shortcutFocus': 'enfocar input',
		'home.shortcutNext': 'siguiente test después del resultado',
		'home.shortcutFinishZen': 'terminar zen',
		'home.selectTimeModeAria': 'seleccionar modo tiempo',
		'home.selectWordsModeAria': 'seleccionar modo palabras',
		'home.selectQuoteLanguageAria': 'seleccionar idioma de quote',
		'home.resultChartAria': 'gráfico del resultado',
		'home.historyEmpty': 'Todavía no guardaste resultados. Tu próxima corrida arranca el historial.',
		'home.resultTimeout': 'tiempo cumplido',
		'home.resultCompleted': 'test completado',
		'home.resultSummary': '{wpm} WPM • {accuracy} • {errors} errores',
		'home.toastSavedTitle': 'resultado guardado',
		'home.toastSavedBody': 'Tu corrida ya quedó en el historial.',
		'home.error.saveResult': 'No se pudo guardar el resultado.',
		'home.error.loadQuote': 'No se pudo obtener una quote.',
		'home.error.quoteUnavailable': 'No se pudo obtener una quote.',
		'home.error.wordsSeedUnavailable': 'No se pudo preparar un texto de {count} palabras con la seed disponible.',
		'home.error.updatePreferences': 'No se pudieron actualizar las preferencias.',
		'home.error.loadExperience': 'No se pudo cargar la experiencia de typing.',
		'home.loadingZen': 'preparando modo zen...',
		'home.loadingWords': 'preparando palabras {count}...',
		'home.loadingQuote': 'cargando quote desde el backend...',
		'home.zenSource': 'modo zen • {language} • Ctrl+Enter para terminar',
		'home.quoteBackendSource': 'quote backend • {language}',
		'home.chart.tooltipError': 'Error',
		'home.chart.tooltipSeries': '{label}: {value} WPM',
		'home.chart.timeAxis': 'tiempo',
		'home.chart.wpmAxis': 'wpm',
		'home.mode.timeDisplay': 'Tiempo {duration}s',
		'home.mode.wordsDisplay': 'Palabras {count}',
		'home.mode.quoteDisplay': 'Quote',
		'home.mode.zenDisplay': 'Zen',
		'home.mode.customDisplay': 'Custom',
		'settings.title': 'MonkeyType | Configuración',
		'settings.descriptionMeta': 'Configuración privada de MonkeyType conectada a preferencias reales del backend.',
		'settings.pageEyebrow': 'configuración',
		'settings.pageTitle': 'Ajustá la experiencia hasta que se sienta tuya.',
		'settings.pageDescription': 'La estructura visual sigue siendo profunda y ordenada, pero ahora theme, idioma de quote, defaultMode, timeDuration, live WPM, punctuation, numbers y sound se leen y persisten contra la API real.',
		'settings.profile': 'perfil',
		'settings.logout': 'cerrar sesión',
		'settings.experience': 'experiencia',
		'settings.core': 'core',
		'settings.experienceBody': 'Lo esencial para que la home tipográfica llegue lista: tema, idioma de quote y modo por defecto.',
		'settings.uiLanguage': 'idioma de la interfaz',
		'settings.uiLanguageAria': 'selector de idioma de la interfaz',
		'settings.uiLanguageBody': 'Cambia el idioma de toda la interfaz de la página sin afectar el idioma de las quotes.',
		'settings.theme': 'tema',
		'settings.quoteLanguage': 'idioma quote',
		'settings.defaultMode': 'modo por defecto',
		'settings.timeDuration': 'duración de tiempo',
		'settings.liveFeedback': 'feedback vivo',
		'settings.runtime': 'runtime',
		'settings.liveFeedbackBody': 'Controlá cuánta señal aparece mientras escribís y si querés audio mínimo para error/success.',
		'settings.showLiveWpm': 'mostrar WPM vivo',
		'settings.showLiveWpmBody': 'Muestra u oculta la métrica viva en la pantalla principal.',
		'settings.punctuationEnabled': 'puntuación activa',
		'settings.punctuationEnabledBody': 'En words/time conserva signos; en quote se mantiene siempre el texto natural.',
		'settings.numbersEnabled': 'números activos',
		'settings.numbersEnabledBody': 'En words/time conserva números; apagado deriva el texto desde la quote original sin dígitos.',
		'settings.soundEnabled': 'sonido activo',
		'settings.soundEnabledBody': 'Activa tonos sutiles para errores y finalización del test.',
		'settings.preview': 'preview',
		'settings.now': 'ahora',
		'settings.previewBullet1': 'La home usa idioma de quote + modo por defecto + duración para elegir quote, duración base o armar words 50/100/150.',
		'settings.previewBullet2': 'Words y time derivan el texto desde la quote original aplicando filtros de puntuación y números.',
		'settings.previewBullet3': 'El tema se aplica en caliente sobre el layout actual.',
		'settings.previewBullet4': 'Zen guarda stats/resultados, pero no persiste el texto libre como quote en Mongo.',
		'settings.previewBullet5': 'Los cambios se guardan con PATCH real a /api/users/me/preferences.',
		'settings.dangerTitle': 'zona sensible',
		'settings.session': 'sesión',
		'settings.dangerBody': 'Mantenemos una zona sensible, pero sin humo: podés descartar cambios locales o cerrar sesión del dispositivo actual.',
		'settings.discardChanges': 'descartar cambios',
		'settings.savePreferences': 'guardar preferencias',
		'settings.theme.system': 'system',
		'settings.theme.dark': 'dark',
		'settings.theme.light': 'light',
		'settings.language.english': 'inglés',
		'settings.language.spanish': 'español',
		'settings.mode.time': 'Time (duración configurable)',
		'settings.mode.quote': 'Quote completa',
		'settings.mode.words': 'Words (50 / 100 / 150 en home)',
		'settings.mode.zen': 'Zen (escritura libre)',
		'settings.mode.custom': 'Custom',
		'settings.time.30': '30 segundos',
		'settings.time.60': '60 segundos',
		'settings.time.120': '120 segundos',
		'settings.summary': 'Tema {theme} • {language} • {mode} • WPM vivo {liveWpm} • puntuación {punctuation} • números {numbers} • sonido {sound}',
		'settings.summary.mode.time': 'tiempo {duration}s',
		'settings.summary.mode.words': 'words 50/100/150 en home',
		'common.on': 'on',
		'common.off': 'off',
		'common.accuracy': 'precisión',
		'settings.toast.noChangesTitle': 'sin cambios',
		'settings.toast.noChangesText': 'No hay preferencias nuevas para guardar.',
		'settings.status.saving': 'guardando preferencias reales en el backend...',
		'settings.status.updated': 'preferencias actualizadas correctamente.',
		'settings.toast.savedTitle': 'preferencias guardadas',
		'settings.toast.savedText': 'Tu configuración ya quedó persistida en el backend.',
		'settings.status.loading': 'cargando preferencias...',
		'settings.error.save': 'No se pudieron guardar las preferencias.',
		'settings.error.load': 'No se pudieron cargar las preferencias.',
		'app.redirectTitle': 'MonkeyType | Redirigiendo',
		'app.redirectDescription': 'Redirección interna a la nueva ruta privada principal.',
		'app.redirectBody': 'Redirigiendo a tu nuevo home privado...',
		'alerts.ok': 'Entendido',
		'alerts.retry': 'Reintentar',
		'alerts.okShort': 'Ok',
		'alerts.errorTitle': 'No se pudo completar la acción',
		'auth.validation.enterEmail': 'Ingresá tu email para continuar con la recuperación.',
		'auth.reset.checkEmailTitle': 'Revisá tu correo',
		'auth.reset.checkEmailBody': 'Si el email existe en MonkeyType, ya enviamos el enlace de recuperación.',
		'auth.validation.missingToken': 'Falta el token de recuperación en el enlace.',
		'auth.validation.enterNewPassword': 'Ingresá tu nueva contraseña.',
		'auth.validation.passwordMismatch': 'Las contraseñas no coinciden.',
		'auth.reset.updatedTitle': 'Contraseña actualizada',
		'auth.reset.updatedBody': 'Ya podés iniciar sesión con tu nueva contraseña.',
		'auth.reset.invalidLinkTitle': 'Enlace inválido o vencido',
		'auth.reset.invalidLinkBody': 'Pedí un nuevo enlace de recuperación para continuar.',
		'auth.validation.completeRequired': 'Completá los campos requeridos.',
		'auth.validation.enterVisibleName': 'Ingresá un nombre visible para tu cuenta.',
		'auth.toast.loginSuccessTitle': 'Login exitoso',
		'auth.toast.loginSuccessBody': 'Redirigiendo a tu dashboard.',
		'auth.toast.registerSuccessTitle': 'Cuenta creada',
		'auth.toast.registerSuccessBody': 'Bienvenido a MonkeyType.',
		'auth.unexpectedError': 'Ocurrió un error inesperado.',
		'auth.reset.incompleteLinkTitle': 'Enlace incompleto',
		'auth.reset.incompleteLinkBody': 'Abrí el link completo del email para poder cambiar la contraseña.',
		'auth.session.storedToken': 'Token guardado localmente • {timestamp}',
		'auth.session.validating': 'Validando sesión contra /api/auth/me...',
		'auth.session.validated': 'Sesión validada correctamente contra el backend.',
		'auth.session.redirectingLogin': '{message} Redirigiendo a login...',
		'auth.session.expiredRedirecting': 'La sesión expiró. Redirigiendo a login...',
		'apiErrors.INVALID_EMAIL': 'Ingresá un email válido para continuar.',
		'apiErrors.INVALID_PASSWORD': 'La contraseña debe tener al menos 8 caracteres.',
		'apiErrors.INVALID_NAME': 'Ingresá un nombre visible válido.',
		'apiErrors.INVALID_CREDENTIALS': 'Credenciales inválidas.',
		'apiErrors.EMAIL_ALREADY_REGISTERED': 'Ya existe una cuenta registrada con ese email.',
		'apiErrors.INVALID_RESET_TOKEN': 'El enlace de recuperación es inválido o ya no está disponible.',
		'apiErrors.EXPIRED_RESET_TOKEN': 'El enlace de recuperación expiró. Pedí uno nuevo.',
		'apiErrors.AUTH_TOKEN_REQUIRED': 'Necesitás autenticación para continuar.',
		'apiErrors.AUTH_TOKEN_INVALID': 'Tu sesión es inválida o expiró.',
		'apiErrors.AUTH_USER_NOT_FOUND': 'No se pudo encontrar al usuario autenticado.',
		'apiErrors.NOT_FOUND': 'No se encontró el recurso solicitado.',
		'apiErrors.INTERNAL_SERVER_ERROR': 'Ocurrió un error interno del servidor.'
	}
};

function interpolate(template: string, params: Record<string, string | number> = {}) {
	return Object.entries(params).reduce(
		(result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
		template
	);
}

export function normalizeUiLocale(value?: string | null): UiLocale {
	const normalized = String(value || '').toLowerCase();
	if (normalized.startsWith('es')) return 'es';
	if (normalized.startsWith('en')) return 'en';
	return 'en';
}

export function readStoredUiLocale() {
	if (typeof window === 'undefined') {
		return null;
	}

	try {
		const value = window.localStorage.getItem(UI_LOCALE_STORAGE_KEY);
		return value ? normalizeUiLocale(value) : null;
	} catch {
		return null;
	}
}

export function writeStoredUiLocale(locale: UiLocale) {
	if (typeof window === 'undefined') {
		return;
	}

	window.localStorage.setItem(UI_LOCALE_STORAGE_KEY, locale);
}

export function resolveBrowserUiLocale() {
	if (typeof navigator === 'undefined') {
		return 'en' as UiLocale;
	}

	return normalizeUiLocale(navigator.language || navigator.languages?.[0]);
}

export function getCurrentUiLocale(): UiLocale {
	if (typeof document === 'undefined') {
		return 'en';
	}

	return normalizeUiLocale(document.documentElement.dataset.uiLocale || document.documentElement.lang || 'en');
}

export function translate(key: string, params?: Record<string, string | number>, locale = getCurrentUiLocale()) {
	const template = translations[locale]?.[key] ?? translations.en[key] ?? key;
	return interpolate(template, params);
}

export const t = translate;

function setElementText(target: HTMLElement, value: string) {
	if (target.dataset.i18nTarget === 'html') {
		target.innerHTML = value;
		return;
	}

	target.textContent = value;
}

export function applyTranslations(root: ParentNode = document) {
	const locale = getCurrentUiLocale();

	root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
		setElementText(element, translate(element.dataset.i18n || '', undefined, locale));
	});

	root.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach((element) => {
		element.setAttribute('placeholder', translate(element.dataset.i18nPlaceholder || '', undefined, locale));
	});

	root.querySelectorAll<HTMLElement>('[data-i18n-aria-label]').forEach((element) => {
		element.setAttribute('aria-label', translate(element.dataset.i18nAriaLabel || '', undefined, locale));
	});

	root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((element) => {
		element.setAttribute('title', translate(element.dataset.i18nTitle || '', undefined, locale));
	});

	root.querySelectorAll<HTMLOptionElement>('[data-i18n-option]').forEach((element) => {
		element.textContent = translate(element.dataset.i18nOption || '', undefined, locale);
	});

	const titleElement = document.querySelector<HTMLTitleElement>('title[data-i18n-document-title]');
	if (titleElement) {
		titleElement.textContent = translate(titleElement.dataset.i18nDocumentTitle || '', undefined, locale);
	}

	const descriptionElement = document.querySelector<HTMLMetaElement>('meta[data-i18n-meta-description]');
	if (descriptionElement) {
		descriptionElement.setAttribute('content', translate(descriptionElement.dataset.i18nMetaDescription || '', undefined, locale));
	}

	document.documentElement.lang = locale;
	document.documentElement.dataset.i18nReady = 'true';
}

export function setUiLocale(locale: UiLocale) {
	const normalized = normalizeUiLocale(locale);
	document.documentElement.dataset.uiLocale = normalized;
	writeStoredUiLocale(normalized);
	applyTranslations(document);
	document.querySelectorAll<HTMLSelectElement>('[data-ui-locale-select]').forEach((select) => {
		select.value = normalized;
	});
	window.dispatchEvent(new CustomEvent('monkeytype:localechange', { detail: { locale: normalized } }));
}

function bindLocaleSelectors(root: ParentNode = document) {
	root.querySelectorAll<HTMLSelectElement>('[data-ui-locale-select]').forEach((select) => {
		if (select.dataset.bound === 'true') {
			return;
		}

		select.dataset.bound = 'true';
		select.value = getCurrentUiLocale();
		select.addEventListener('change', () => {
			setUiLocale(normalizeUiLocale(select.value));
		});
	});
}

export function initI18n() {
	const initialLocale = readStoredUiLocale() || resolveBrowserUiLocale();
	document.documentElement.dataset.uiLocale = initialLocale;
	bindLocaleSelectors(document);
	applyTranslations(document);
	window.dispatchEvent(new CustomEvent('monkeytype:localechange', { detail: { locale: initialLocale } }));
}
