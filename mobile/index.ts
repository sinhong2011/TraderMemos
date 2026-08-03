// Custom entry so the unistyles theme registers before any screen module
// evaluates its stylesheets (import order matters — expo-router/entry loads
// the whole route tree).
import './src/styles/unistyles';
import 'expo-router/entry';
