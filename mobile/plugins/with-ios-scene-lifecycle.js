// Applies the UIScene lifecycle adoption that the iOS 27 SDK requires but Expo's
// prebuild template does not generate yet (expo/expo#46663). Without it the app
// traps at launch (EXC_BREAKPOINT in
// UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption).
//
// This runs as a config plugin so *every* prebuild gets the patch — including the
// remote prebuild EAS Build runs on its own workers, which never sees
// scripts/apply-ios-scene-patch.sh. patches/ios-scene/AppDelegate.swift stays the
// single source of truth for both paths.
//
// When Expo ships scene adoption in its template, delete this plugin, the
// patches/ directory, and scripts/apply-ios-scene-patch.sh.

const fs = require('node:fs');
const path = require('node:path');

const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const APP_DELEGATE = path.join(__dirname, '..', 'patches', 'ios-scene', 'AppDelegate.swift');

const SCENE_MANIFEST = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [
      {
        UISceneConfigurationName: 'Default Configuration',
        UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
      },
    ],
  },
};

/** @type {import('expo/config-plugins').ConfigPlugin} */
function withIosSceneLifecycle(config) {
  config = withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      throw new Error(
        `with-ios-scene-lifecycle: expected a Swift AppDelegate, got "${config.modResults.language}". ` +
          'The template changed — re-derive patches/ios-scene/AppDelegate.swift from it.'
      );
    }
    // Wholesale replacement, not a string splice: the patch carries ordering that
    // matters (cold-launch deep links merged into launchOptions[.url] *before*
    // startReactNative — see the comments in that file).
    config.modResults.contents = fs.readFileSync(APP_DELEGATE, 'utf8');
    return config;
  });

  config = withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = SCENE_MANIFEST;
    return config;
  });

  return config;
}

module.exports = withIosSceneLifecycle;
