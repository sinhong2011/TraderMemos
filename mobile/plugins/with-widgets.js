// Adds the TraderMemosWidgets WidgetKit extension to the generated Xcode
// project. Same shape as with-ios-scene-lifecycle: ios/ is CNG output, so the
// extension exists only as this plugin + the sources in targets/widgets/, and
// every prebuild — local or on EAS workers — reconstructs the target from
// scratch.
//
// Three mods:
//   1. App Group entitlement on the app target — the widget reads the
//      snapshot the app writes through modules/widget-bridge, and a shared
//      UserDefaults suite is the only channel they have.
//   2. Copy targets/widgets/ into ios/TraderMemosWidgets/ (dangerous mod,
//      runs before the Xcode mods).
//   3. Register the extension target in the pbxproj. The `xcode` lib's
//      addTarget does the heavy lifting for 'app_extension': product file,
//      embed copy phase on the app target, and the target dependency.
//
// EAS signing for the second target is declared in app.json under
// extra.eas.build.experimental.ios.appExtensions — keep the bundle id and app
// group there in lockstep with the constants here.

const fs = require('node:fs');
const path = require('node:path');

const { withDangerousMod, withEntitlementsPlist, withXcodeProject } = require('expo/config-plugins');

const TARGET_NAME = 'TraderMemosWidgets';
const APP_GROUP = 'group.com.tradermemos.app';

const SWIFT_FILES = [
  'TodaySnapshot.swift',
  'WidgetTheme.swift',
  'TodayWidget.swift',
  'QuickJournalControl.swift',
  'TradingSessionAttributes.swift',
  'TradingSessionLiveActivity.swift',
  'WidgetsBundle.swift',
];
// The ActivityKit attributes are canonical in the live-activity module (the
// app compiles them through its pod); the extension gets a prebuild-time copy
// so the two targets can never drift.
const SHARED_FROM_MODULES = {
  'TradingSessionAttributes.swift': ['modules', 'live-activity', 'ios'],
};
const TARGET_FILES = [...SWIFT_FILES, 'Info.plist', `${TARGET_NAME}.entitlements`];

/** @type {import('expo/config-plugins').ConfigPlugin} */
function withWidgets(config) {
  config = withEntitlementsPlist(config, (config) => {
    const groups = config.modResults['com.apple.security.application-groups'];
    const merged = new Set(Array.isArray(groups) ? groups : []);
    merged.add(APP_GROUP);
    config.modResults['com.apple.security.application-groups'] = [...merged];
    return config;
  });

  config = withDangerousMod(config, [
    'ios',
    (config) => {
      const source = path.join(config.modRequest.projectRoot, 'targets', 'widgets');
      const destination = path.join(config.modRequest.platformProjectRoot, TARGET_NAME);
      fs.mkdirSync(destination, { recursive: true });
      for (const file of TARGET_FILES) {
        const from = SHARED_FROM_MODULES[file]
          ? path.join(config.modRequest.projectRoot, ...SHARED_FROM_MODULES[file], file)
          : path.join(source, file);
        fs.copyFileSync(from, path.join(destination, file));
      }
      return config;
    },
  ]);

  config = withXcodeProject(config, (config) => {
    const project = config.modResults;
    if (project.pbxTargetByName(TARGET_NAME)) return config;

    const appBundleId = config.ios?.bundleIdentifier;
    if (!appBundleId) {
      throw new Error('with-widgets: ios.bundleIdentifier missing from the Expo config.');
    }
    const bundleId = `${appBundleId}.widgets`;

    // File references first, grouped under a TraderMemosWidgets folder hung
    // off the project root, so the build phase below finds them by name.
    const group = project.addPbxGroup(TARGET_FILES, TARGET_NAME, TARGET_NAME);
    const groups = project.hash.project.objects.PBXGroup;
    for (const key of Object.keys(groups)) {
      // The main group is the only one with neither name nor path.
      if (groups[key].name === undefined && groups[key].path === undefined) {
        project.addToPbxGroup(group.uuid, key);
      }
    }

    const target = project.addTarget(TARGET_NAME, 'app_extension', TARGET_NAME, bundleId);
    project.addBuildPhase(SWIFT_FILES, 'PBXSourcesBuildPhase', 'Sources', target.uuid);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
    project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);

    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const settings = configurations[key]?.buildSettings;
      if (!settings || settings.PRODUCT_NAME !== `"${TARGET_NAME}"`) continue;
      Object.assign(settings, {
        CLANG_ENABLE_MODULES: 'YES',
        CODE_SIGN_ENTITLEMENTS: `"${TARGET_NAME}/${TARGET_NAME}.entitlements"`,
        CODE_SIGN_STYLE: 'Automatic',
        CURRENT_PROJECT_VERSION: '1',
        GENERATE_INFOPLIST_FILE: 'NO',
        INFOPLIST_FILE: `"${TARGET_NAME}/Info.plist"`,
        // Accessory (Lock Screen) families and containerBackground need 16/17;
        // 17 keeps the view code on one API path.
        IPHONEOS_DEPLOYMENT_TARGET: '17.0',
        MARKETING_VERSION: config.version ?? '1.0.0',
        SWIFT_EMIT_LOC_STRINGS: 'YES',
        SWIFT_VERSION: '5.0',
        TARGETED_DEVICE_FAMILY: '"1,2"',
      });
    }

    return config;
  });

  return config;
}

module.exports = withWidgets;
