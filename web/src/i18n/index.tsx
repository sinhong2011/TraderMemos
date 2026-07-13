import { i18n, type Messages } from "@lingui/core";
import { I18nProvider as LinguiProvider } from "@lingui/react";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	DEFAULT_LOCALE,
	getIntlLocale,
	getStoredLocale,
	isAppLocale,
	setStoredLocale,
	type AppLocale,
} from "../lib/locale";
import { messages as enMessages } from "./locales/en/messages";

export { i18n };

type CatalogModule = { messages: Messages };

const catalogLoaders: Record<AppLocale, () => Promise<CatalogModule>> = {
	en: async () => ({ messages: enMessages }),
	"zh-HK": () => import("./locales/zh-HK/messages"),
	ja: () => import("./locales/ja/messages"),
	ko: () => import("./locales/ko/messages"),
};

i18n.load(DEFAULT_LOCALE, enMessages);

type LocaleContextValue = {
	locale: AppLocale;
	intlLocale: string;
	setLocale: (locale: string) => Promise<void>;
	ready: boolean;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export async function loadLocale(locale: string): Promise<void> {
	const next = isAppLocale(locale) ? locale : DEFAULT_LOCALE;
	const { messages } = await catalogLoaders[next]();
	i18n.load(next, messages);
	i18n.activate(next);
	setStoredLocale(next);
	document.documentElement.lang = getIntlLocale(next);
}

export function I18nProvider({ children }: { children: ReactNode }) {
	const [locale, setLocaleState] = useState<AppLocale>(getStoredLocale);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			await loadLocale(getStoredLocale());
			if (!cancelled && isAppLocale(i18n.locale)) {
				setLocaleState(i18n.locale);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		return i18n.on("change", () => {
			if (isAppLocale(i18n.locale)) {
				setLocaleState(i18n.locale);
			}
		});
	}, []);

	const setLocale = useCallback(async (next: string) => {
		await loadLocale(next);
		if (isAppLocale(i18n.locale)) {
			setLocaleState(i18n.locale);
		}
	}, []);

	const value = useMemo(
		() => ({
			locale,
			intlLocale: getIntlLocale(locale),
			setLocale,
			ready: true,
		}),
		[locale, setLocale],
	);

	return (
		<LocaleContext.Provider value={value}>
			<LinguiProvider i18n={i18n}>{children}</LinguiProvider>
		</LocaleContext.Provider>
	);
}

export function useLocale(): LocaleContextValue {
	const ctx = useContext(LocaleContext);
	if (!ctx) {
		throw new Error("useLocale must be used within I18nProvider");
	}
	return ctx;
}

export function useIntlLocale(): string {
	return useLocale().intlLocale;
}
