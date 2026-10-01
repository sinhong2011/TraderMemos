// Compiles targets/app-intents/ into the *app* target. Same CNG contract as
// with-widgets: ios/ is generated, so the intents exist only as this plugin
// plus the sources in targets/app-intents/, and every prebuild — local or on
// EAS workers — re-copies and re-links them.
//
// The intents must live in the app target (not a pod, not the widget
// extension): the appintentsmetadataprocessor only reliably discovers
// AppShortcutsProvider metadata from target sources, and `openAppWhenRun` +
// UIApplication.open need the app process anyway. The Control Center control
// is the one intent that lives in the widget extension instead (iOS 18
// controls are WidgetKit) — see targets/widgets/QuickJournalControl.swift.

const fs = require('node:fs');
const path = require('node:path');

const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');

// Sources and the folder each comes from. targets/shared/ is also compiled
// into the widget extension (with-widgets): Siri runs these intents in the
// app process, the widget buttons run the same ones in the extension.
const SOURCES = {
  'AppShortcuts.swift': 'app-intents',
  'TMShared.swift': 'shared',
  'RoutineIntents.swift': 'shared',
};
const SWIFT_FILES = Object.keys(SOURCES);

/** @type {import('expo/config-plugins').ConfigPlugin} */
function withAppIntents(config) {
  config = withDangerousMod(config, [
    'ios',
    (config) => {
      const destination = path.join(
        config.modRequest.platformProjectRoot,
        config.modRequest.projectName,
      );
      for (const file of SWIFT_FILES) {
        const source = path.join(config.modRequest.projectRoot, 'targets', SOURCES[file], file);
        fs.copyFileSync(source, path.join(destination, file));
      }
      return config;
    },
  ]);

  config = withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectName = config.modRequest.projectName;
    for (const file of SWIFT_FILES) {
      const filepath = `${projectName}/${file}`;
      if (project.hasFile(filepath)) continue;
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath,
        groupName: projectName,
        project,
      });
    }
    return config;
  });

  return config;
}

module.exports = withAppIntents;
