const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);

// Uniwind compiles src/global.css (Tailwind v4 + the PanelUI theme) into the
// bundle and regenerates uniwind-types.d.ts so className strings typecheck.
// Only the default light/dark themes are registered — the app pins its own
// scheme preference through useThemeMode, not PanelUI's named families.
module.exports = withUniwindConfig(config, {
  cssEntryFile: './src/global.css',
  dtsFile: './uniwind-types.d.ts',
});
