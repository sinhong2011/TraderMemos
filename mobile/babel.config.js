module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Transforms t`...` / msg`...` macros into ICU message calls (same
      // toolchain as web; see web/lingui.config.ts).
      '@lingui/babel-plugin-lingui-macro',
    ],
  };
};
