// Copy and art direction for the store listings.
//
// One entry per artboard, in listing order. `screenshot` is the raw device
// capture (see capture-ios.sh / capture-android.sh); everything else is the
// marketing layer drawn around it.
//
// Accent + glow shift along a narrow blue→indigo arc across the set: enough
// that the six frames read as a sequence rather than one slide repeated, not
// so much that they stop looking like one product.

export const THEME = {
  base: '#070A10',
  vignette: 'rgba(3, 5, 9, 0.92)',
  glowY: '30%',
  glowSecondary: 'rgba(18, 100, 178, 0.14)',
  headline: '#F5F7FA',
  eyebrow: 'rgba(233, 240, 250, 0.46)',
  sub: 'rgba(226, 234, 245, 0.62)',
  rim: 'linear-gradient(152deg, #3b424c 0%, #9aa3b0 14%, #5a626d 34%, #b6bec9 58%, #4e565f 78%, #2f353d 100%)',
  headlineSize: 0.0655, // × canvas width
  // Sized so the device runs just past the bottom edge while the app's own tab
  // bar stays fully visible — cutting through the tab bar reads as a mistake.
  deviceWidth: 0.775, // × canvas width
  cornerRatio: 0.118, // × device width, matching the real hardware proportion
  deviceGap: 0.036, // × canvas height
}

// Play Store phone artboards are 9:16 while the phone itself is nearly 9:20, so
// the device has to be narrower to leave the caption any room — and it ends up
// cropped well above the tab bar no matter what. Everything else is shared, so
// the two listings stay recognisably the same campaign.
export const PLATFORM_THEME = {
  android: {
    headlineSize: 0.062,
    deviceWidth: 0.60,
    deviceGap: 0.030,
  },
  // The iPad artboard is 3:4 rather than a tall phone strip, so the headline is
  // proportionally smaller and the slab is wide and shallow.
  ipad: {
    headlineSize: 0.052,
    deviceWidth: 0.72,
    cornerRatio: 0.042,
    deviceGap: 0.032,
  },
}

export const SHOTS = [
  {
    slug: 'performance',
    screen: 'home',
    eyebrow: 'Performance',
    headline: 'Know your <em>edge</em>,<br>not just your P&amp;L',
    sub: 'Equity curve, profit factor and expectancy, recalculated on every fill you log.',
    accent: '#63B3F6',
    glow: 'rgba(18, 100, 178, 0.42)',
  },
  {
    slug: 'trades',
    screen: 'trades',
    eyebrow: 'Journal',
    headline: 'Every fill, grouped<br>into the <em>real trade</em>',
    sub: 'Scale-ins, partials and scale-outs collapse into one position with one honest number.',
    accent: '#6FBDF2',
    glow: 'rgba(21, 108, 176, 0.40)',
  },
  {
    slug: 'coach',
    screen: 'trade-detail',
    eyebrow: 'Coach',
    headline: 'A second opinion<br>on <em>every trade</em>',
    sub: 'Each trade is checked against your playbook, your emotional state and the reasons you did not write down.',
    accent: '#7FA8F4',
    glow: 'rgba(38, 88, 186, 0.40)',
  },
  {
    slug: 'calendar',
    screen: 'calendar',
    eyebrow: 'Calendar',
    headline: 'See the <em>shape</em><br>of your month',
    sub: 'Green days, red days, and every streak between them at a glance.',
    accent: '#8E9DF5',
    glow: 'rgba(58, 78, 190, 0.38)',
  },
  {
    slug: 'reports',
    screen: 'reports',
    eyebrow: 'Reports',
    headline: 'Answers, not just<br><em>averages</em>',
    sub: 'Break performance down by setup, symbol, session, weekday and hour of the day.',
    accent: '#9C93F2',
    glow: 'rgba(74, 66, 186, 0.38)',
  },
  {
    slug: 'self-hosted',
    screen: 'sign-in',
    eyebrow: 'Self-hosted',
    headline: 'Your journal.<br><em>Your server.</em>',
    sub: 'TraderMemos runs on hardware you control. No accounts, no cloud, no one else reading your book.',
    accent: '#63B3F6',
    glow: 'rgba(18, 100, 178, 0.42)',
  },
]
