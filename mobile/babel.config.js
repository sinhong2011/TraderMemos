module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Transforms t`...` / msg`...` macros into ICU message calls (same
      // toolchain as web; see web/lingui.config.ts).
      '@lingui/babel-plugin-lingui-macro',
      // Wires StyleSheet.create((theme) => …) sheets to the C++ core so
      // components re-render on theme changes without hooks.
      ['react-native-unistyles/plugin', { root: 'src' }],
    ],
  };
};
