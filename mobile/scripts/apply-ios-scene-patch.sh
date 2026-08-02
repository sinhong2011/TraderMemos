#!/usr/bin/env bash
# Re-apply the hand-maintained UIScene lifecycle adoption after `expo prebuild --clean`.
#
# The iOS 27 SDK requires the UIScene lifecycle, but Expo's prebuild template does not
# generate it yet (expo/expo#46663) — without this patch the app traps at launch
# (EXC_BREAKPOINT in UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption).
#
# What it does:
#   1. Replaces ios/TraderMemos/AppDelegate.swift with patches/ios-scene/AppDelegate.swift
#      (adds a SceneDelegate; cold-launch deep links merged into launchOptions[.url]
#      BEFORE startReactNative — see the comments in that file for why order matters).
#   2. Adds UIApplicationSceneManifest to ios/TraderMemos/Info.plist (idempotent).
#
# When Expo ships scene adoption in its template, delete this script, the patches/
# directory, and the `prebuild-ios` make target.
set -euo pipefail
cd "$(dirname "$0")/.."

APP_DELEGATE=ios/TraderMemos/AppDelegate.swift
PLIST=ios/TraderMemos/Info.plist
PATCH=patches/ios-scene/AppDelegate.swift

[ -f "$APP_DELEGATE" ] || { echo "error: $APP_DELEGATE not found — run expo prebuild first" >&2; exit 1; }

if grep -q 'class SceneDelegate' "$APP_DELEGATE"; then
  echo "AppDelegate.swift already scene-adopted — leaving as is"
else
  cp "$PATCH" "$APP_DELEGATE"
  echo "AppDelegate.swift: scene adoption applied"
fi

if /usr/libexec/PlistBuddy -c 'Print :UIApplicationSceneManifest' "$PLIST" >/dev/null 2>&1; then
  echo "Info.plist already has UIApplicationSceneManifest — leaving as is"
else
  /usr/libexec/PlistBuddy \
    -c 'Add :UIApplicationSceneManifest dict' \
    -c 'Add :UIApplicationSceneManifest:UIApplicationSupportsMultipleScenes bool false' \
    -c 'Add :UIApplicationSceneManifest:UISceneConfigurations dict' \
    -c 'Add :UIApplicationSceneManifest:UISceneConfigurations:UIWindowSceneSessionRoleApplication array' \
    -c 'Add :UIApplicationSceneManifest:UISceneConfigurations:UIWindowSceneSessionRoleApplication:0 dict' \
    -c 'Add :UIApplicationSceneManifest:UISceneConfigurations:UIWindowSceneSessionRoleApplication:0:UISceneConfigurationName string Default Configuration' \
    -c 'Add :UIApplicationSceneManifest:UISceneConfigurations:UIWindowSceneSessionRoleApplication:0:UISceneDelegateClassName string $(PRODUCT_MODULE_NAME).SceneDelegate' \
    "$PLIST"
  echo "Info.plist: UIApplicationSceneManifest added"
fi
