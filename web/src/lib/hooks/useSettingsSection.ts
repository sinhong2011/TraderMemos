import { useCallback, useEffect, useState } from "react";
import type { SettingsSectionId } from "../../app/screens/settings/settings-ui";
import {
	DEFAULT_SETTINGS_SECTION,
	parseSettingsHash,
	settingsSectionHash,
} from "../settingsSection";

function readSectionFromLocation(): SettingsSectionId {
	if (typeof window === "undefined") return DEFAULT_SETTINGS_SECTION;
	return parseSettingsHash(window.location.hash);
}

export function useSettingsSection() {
	const [section, setSectionState] = useState<SettingsSectionId>(readSectionFromLocation);

	useEffect(() => {
		const syncFromHash = () => {
			setSectionState(readSectionFromLocation());
		};

		if (!window.location.hash) {
			const base = `${window.location.pathname}${window.location.search}`;
			window.history.replaceState(null, "", `${base}${settingsSectionHash(DEFAULT_SETTINGS_SECTION)}`);
			setSectionState(DEFAULT_SETTINGS_SECTION);
		}

		window.addEventListener("hashchange", syncFromHash);
		return () => window.removeEventListener("hashchange", syncFromHash);
	}, []);

	const setSection = useCallback((id: SettingsSectionId) => {
		const nextHash = settingsSectionHash(id);
		if (window.location.hash !== nextHash) {
			window.location.hash = id;
			return;
		}
		setSectionState(id);
	}, []);

	return [section, setSection] as const;
}
