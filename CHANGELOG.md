# Changelog

All notable changes to TraderMemos are documented in this file.

Release versioning is managed by [release-please](https://github.com/googleapis/release-please).
See [docs/release.md](docs/release.md) for the release workflow.

## [0.8.2](https://github.com/sinhong2011/TraderMemos/compare/v0.8.1...v0.8.2) (2026-08-13)


### Bug Fixes

* **api:** renumber the alerts Postgres migration to 000007 ([#219](https://github.com/sinhong2011/TraderMemos/issues/219)) ([b7454ab](https://github.com/sinhong2011/TraderMemos/commit/b7454abec2a14c2d6a66ade855b56e7b663ce0b7))

## [0.8.1](https://github.com/sinhong2011/TraderMemos/compare/v0.8.0...v0.8.1) (2026-08-12)


### Bug Fixes

* **mobile:** define PODS_ROOT on the widgets target so EAS ccache builds resolve ([#217](https://github.com/sinhong2011/TraderMemos/issues/217)) ([62ac63d](https://github.com/sinhong2011/TraderMemos/commit/62ac63db836806470be6c6b640cea31d864c5b02))

## [0.8.0](https://github.com/sinhong2011/TraderMemos/compare/v0.7.0...v0.8.0) (2026-08-12)


### Features

* **alerts:** journal alerts — risk rules, loss limits, prop drawdown (free) ([#185](https://github.com/sinhong2011/TraderMemos/issues/185)) ([2e374f2](https://github.com/sinhong2011/TraderMemos/commit/2e374f2dcf871769ee013fec7e464e8967a72d2e))
* **analytics:** execution-quality composite score with per-axis drill-down ([#183](https://github.com/sinhong2011/TraderMemos/issues/183)) ([ac430db](https://github.com/sinhong2011/TraderMemos/commit/ac430dbd7ad99a4277a3e09ebf7fc94bfc73b529))
* **analytics:** Monte Carlo simulation on Reports ([#155](https://github.com/sinhong2011/TraderMemos/issues/155)) ([dbbb639](https://github.com/sinhong2011/TraderMemos/commit/dbbb639251be8e33fefa89cec7eddd019afafd7e))
* **calendar:** weekly totals, month header chips, day detail popover ([#168](https://github.com/sinhong2011/TraderMemos/issues/168)) ([c9fb843](https://github.com/sinhong2011/TraderMemos/commit/c9fb8438b5cb1a5eebff51d4f0871ac177195fd7))
* **docs:** publish the API reference with fumadocs-openapi + Scalar ([#187](https://github.com/sinhong2011/TraderMemos/issues/187)) ([49fdcff](https://github.com/sinhong2011/TraderMemos/commit/49fdcff89743f8f7d34ea6d6eb1c9f69f65a3f1c))
* **importer:** cTrader, DXtrade and Match-Trader broker presets ([#153](https://github.com/sinhong2011/TraderMemos/issues/153)) ([bbee550](https://github.com/sinhong2011/TraderMemos/commit/bbee55003d7d8363916299be418a9765d282e280))
* **importer:** MT4/MT5 statement parsers (XLSX + HTML) ([#166](https://github.com/sinhong2011/TraderMemos/issues/166)) ([6402160](https://github.com/sinhong2011/TraderMemos/commit/64021602f1c3b98537cde71c37763090dfd0afc1))
* **marketing:** Aceternity-style landing revamp + live demo CTA ([#189](https://github.com/sinhong2011/TraderMemos/issues/189)) ([4607e1b](https://github.com/sinhong2011/TraderMemos/commit/4607e1b51ba583b167743567a37fc3de7c2644bb))
* **marketing:** feature + comparison pages ([#188](https://github.com/sinhong2011/TraderMemos/issues/188)) ([2c2e281](https://github.com/sinhong2011/TraderMemos/commit/2c2e281887ffcfdee3044945fec3c8bc935a8a61))
* **mobile:** change the API server from Settings ([#214](https://github.com/sinhong2011/TraderMemos/issues/214)) ([201594f](https://github.com/sinhong2011/TraderMemos/commit/201594f6686ec84154a86ce620add18113f26a0f))
* **mobile:** Live Activity / Dynamic Island trading session ([#176](https://github.com/sinhong2011/TraderMemos/issues/176)) ([3ed5b91](https://github.com/sinhong2011/TraderMemos/commit/3ed5b91dfc51f3f1a5f3acea245aa6e7480f6922))
* **mobile:** offline journaling write queue ([#179](https://github.com/sinhong2011/TraderMemos/issues/179)) ([661d6bd](https://github.com/sinhong2011/TraderMemos/commit/661d6bd526b2649627acc31ba3fc6615903aa278))
* **mobile:** privacy-mode eye toggle in the Home header ([#205](https://github.com/sinhong2011/TraderMemos/issues/205)) ([18fad99](https://github.com/sinhong2011/TraderMemos/commit/18fad99ef4ec551e53a6c7da9325cc0f9cbb248d))
* **mobile:** repurpose Advanced chart into a Symbol journal ([#212](https://github.com/sinhong2011/TraderMemos/issues/212)) ([#213](https://github.com/sinhong2011/TraderMemos/issues/213)) ([26fc14e](https://github.com/sinhong2011/TraderMemos/commit/26fc14e404cd1913883d5644a6a9d29324dbc0e7))
* **mobile:** share card styles + Wrapped/Reports share export ([#180](https://github.com/sinhong2011/TraderMemos/issues/180)) ([141b2ec](https://github.com/sinhong2011/TraderMemos/commit/141b2ec42e19a1ab0eeafc4fa5ee68471af9cbaf))
* **mobile:** Siri / App Intents / Action Button quick journal ([#177](https://github.com/sinhong2011/TraderMemos/issues/177)) ([fb88f0e](https://github.com/sinhong2011/TraderMemos/commit/fb88f0e2204e5bc650578cb532cdbe69f1180b93))
* **mobile:** swipeable Year Wrapped paging + Reports header entry ([#201](https://github.com/sinhong2011/TraderMemos/issues/201)) ([d96f0fc](https://github.com/sinhong2011/TraderMemos/commit/d96f0fc35d79d3dfaee1f8c0a0e1ea0c1d72644c))
* **mobile:** tappable calendar week tile + week return on the equity-curve basis ([#208](https://github.com/sinhong2011/TraderMemos/issues/208)) ([5770ef3](https://github.com/sinhong2011/TraderMemos/commit/5770ef35708d3a291f5ea5e6b7b027454ae2d0c4))
* **mobile:** WidgetKit Home + Lock Screen widgets ([#174](https://github.com/sinhong2011/TraderMemos/issues/174)) ([3bc9e4e](https://github.com/sinhong2011/TraderMemos/commit/3bc9e4eeb9e7b66b397ab810411a0e886b2df166))
* **portfolio:** multi-account portfolio mode with same-currency scopes ([#196](https://github.com/sinhong2011/TraderMemos/issues/196)) ([5fa00a2](https://github.com/sinhong2011/TraderMemos/commit/5fa00a241db35e86be003f4f57a3b5e6865cb444))
* **replay:** free-symbol bar-replay backtester with paper-account persistence ([#184](https://github.com/sinhong2011/TraderMemos/issues/184)) ([0eff369](https://github.com/sinhong2011/TraderMemos/commit/0eff369dbead010807c465c83672cae37c911928))
* **reports:** chart quick wins — duration scatter, signed bars, period returns, session clock ([#170](https://github.com/sinhong2011/TraderMemos/issues/170)) ([4f814d6](https://github.com/sinhong2011/TraderMemos/commit/4f814d60a3c8f188178b94610a8b28daf107a257))
* **reports:** saved view presets — named card set, order, range and filters ([#190](https://github.com/sinhong2011/TraderMemos/issues/190)) ([91bc231](https://github.com/sinhong2011/TraderMemos/commit/91bc231a54dbebf0df8f0e506b267bbbf34e8b32))
* **reports:** universal per-card range selector + fullscreen expand ([#181](https://github.com/sinhong2011/TraderMemos/issues/181)) ([92f025e](https://github.com/sinhong2011/TraderMemos/commit/92f025e76bc63b52f876ba1022ebc9ab2518cf55))
* **share:** public share pages — revocable read-only performance links ([#158](https://github.com/sinhong2011/TraderMemos/issues/158)) ([cac9de4](https://github.com/sinhong2011/TraderMemos/commit/cac9de4e5789724b54225333c4929648c46e3c20))
* **tm-sync:** local statement watcher agent ([#167](https://github.com/sinhong2011/TraderMemos/issues/167)) ([00f7391](https://github.com/sinhong2011/TraderMemos/commit/00f7391846f27970ca23753d63f196ab6521f2b0))
* **trades:** MAE/MFE intra-trade excursion chart ([#182](https://github.com/sinhong2011/TraderMemos/issues/182)) ([33e3078](https://github.com/sinhong2011/TraderMemos/commit/33e30788257f228408c8f6bac5afa1ee7ef64bc8))
* **web:** show a spinner on the new-trade Save button ([#211](https://github.com/sinhong2011/TraderMemos/issues/211)) ([5780b52](https://github.com/sinhong2011/TraderMemos/commit/5780b520db1ca2f1b4027ebfedf5b7084555fc2e))


### Bug Fixes

* **api:** repair Postgres regroup delete; toast import failures ([#192](https://github.com/sinhong2011/TraderMemos/issues/192)) ([13733ce](https://github.com/sinhong2011/TraderMemos/commit/13733ceb763fb382420b9f9a2202860d7de26fd6))
* **docker:** set CI=true in web image build for headless pnpm ([#210](https://github.com/sinhong2011/TraderMemos/issues/210)) ([a85ef1a](https://github.com/sinhong2011/TraderMemos/commit/a85ef1a62c09f31913ec685b818b4750086dbc04))
* **mobile:** drop the Change server button from the Settings hub ([#215](https://github.com/sinhong2011/TraderMemos/issues/215)) ([57952fa](https://github.com/sinhong2011/TraderMemos/commit/57952fad34bbd370dc471d67a57d7972705319d8))
* **mobile:** hide the offline banner behind a full-screen network error ([#207](https://github.com/sinhong2011/TraderMemos/issues/207)) ([c808d08](https://github.com/sinhong2011/TraderMemos/commit/c808d08490cb8e76656e58e6a6ef7d5477cd0467))
* **mobile:** inset Reports sections under the iOS tab bar ([#197](https://github.com/sinhong2011/TraderMemos/issues/197)) ([84e3326](https://github.com/sinhong2011/TraderMemos/commit/84e33267edd966b49c3d4e61657d4132e46ac4ea))
* **mobile:** right-align the metric-evolution switcher ([#200](https://github.com/sinhong2011/TraderMemos/issues/200)) ([3de6d8a](https://github.com/sinhong2011/TraderMemos/commit/3de6d8a300859e5f6649c327e45167bab9befcc2))
* **tm-sync:** portable SQLite migrate lock for Windows cross-compile ([#209](https://github.com/sinhong2011/TraderMemos/issues/209)) ([aae6acd](https://github.com/sinhong2011/TraderMemos/commit/aae6acd49f130e3424f17eda54ad3837aeeaecb1))
* **web:** render release notes as a structured changelog ([#178](https://github.com/sinhong2011/TraderMemos/issues/178)) ([bf8fe27](https://github.com/sinhong2011/TraderMemos/commit/bf8fe2793ce2afe3fbe61e28105db55bee5b81e1))


### Performance Improvements

* **import:** batch import and regroup writes ([#193](https://github.com/sinhong2011/TraderMemos/issues/193)) ([d2e36f1](https://github.com/sinhong2011/TraderMemos/commit/d2e36f1c90832fcfdd079543c193fba33f27f829))

## [0.7.0](https://github.com/sinhong2011/TraderMemos/compare/v0.6.1...v0.7.0) (2026-08-09)


### Features

* **mobile:** option call/put chips, trade-row redesign, Reports-into-Dashboard, settings search ([#169](https://github.com/sinhong2011/TraderMemos/issues/169)) ([ba6e999](https://github.com/sinhong2011/TraderMemos/commit/ba6e999a80be1e7e0339071ab948a07bb5900a26))


### Bug Fixes

* **docker:** build the web bundle natively, not under QEMU ([#171](https://github.com/sinhong2011/TraderMemos/issues/171)) ([b3fe070](https://github.com/sinhong2011/TraderMemos/commit/b3fe0706efe6574f40d7a90f5710065bcfa441de))
* **mobile:** remove iOS 27 hard scroll-edge border on settings Form screens ([#165](https://github.com/sinhong2011/TraderMemos/issues/165)) ([65c5047](https://github.com/sinhong2011/TraderMemos/commit/65c504715f7483c58636137a3b83e96c7ac70e03))
* **scripts:** stop setup hanging on a non-functional corepack ([#156](https://github.com/sinhong2011/TraderMemos/issues/156)) ([1789171](https://github.com/sinhong2011/TraderMemos/commit/17891717b616db924b4fd714513118ef2193538b))
* **web:** stop the update toast from reappearing every session ([#157](https://github.com/sinhong2011/TraderMemos/issues/157)) ([60f62a3](https://github.com/sinhong2011/TraderMemos/commit/60f62a306081b9fd577bdc66467554b2be9f723a))

## [0.6.1](https://github.com/sinhong2011/TraderMemos/compare/v0.6.0...v0.6.1) (2026-08-08)


### Bug Fixes

* **mobile:** Appearance pref reaches UIKit + hide iOS 26 scroll-edge effect ([#152](https://github.com/sinhong2011/TraderMemos/issues/152)) ([0362cd9](https://github.com/sinhong2011/TraderMemos/commit/0362cd92cd8030fa2999d98148a32b6179b040fc))

## [0.6.0](https://github.com/sinhong2011/TraderMemos/compare/v0.5.0...v0.6.0) (2026-08-08)


### Features

* **mobile:** human, actionable UI for an unreachable server ([#124](https://github.com/sinhong2011/TraderMemos/issues/124)) ([8acbe1e](https://github.com/sinhong2011/TraderMemos/commit/8acbe1e2f3ae165e78616a8826ae4645374e7b69))


### Bug Fixes

* **api:** make import commit atomic, disconnect-proof, and debuggable ([#117](https://github.com/sinhong2011/TraderMemos/issues/117)) ([4f46409](https://github.com/sinhong2011/TraderMemos/commit/4f46409488fcbb63096c7fa7a45994999fd7e1a3))
* **mobile:** center the fill timestamp and give Review & save a real action button ([#125](https://github.com/sinhong2011/TraderMemos/issues/125)) ([202ef93](https://github.com/sinhong2011/TraderMemos/commit/202ef93863190349d26eeebe6cc885f0094913bb))
* **mobile:** CenteredButton fill-form action + per-fill P&L on review cards ([#122](https://github.com/sinhong2011/TraderMemos/issues/122)) ([c0f2338](https://github.com/sinhong2011/TraderMemos/commit/c0f23385b796bd42eb21faefb241101b7bbcc3dc))
* **mobile:** edit-trade save spinner + phantom pull-to-refresh on trade details ([#120](https://github.com/sinhong2011/TraderMemos/issues/120)) ([f4c479e](https://github.com/sinhong2011/TraderMemos/commit/f4c479e70173efd7120d012aba1caf661020f727))
* **mobile:** paint the trade details screen from the list cache while it loads ([#121](https://github.com/sinhong2011/TraderMemos/issues/121)) ([d3501c4](https://github.com/sinhong2011/TraderMemos/commit/d3501c4721f6b2819fa659a82b9ce33502b85199))
* **mobile:** privacy mode never masks amounts already on screen ([#123](https://github.com/sinhong2011/TraderMemos/issues/123)) ([13b292b](https://github.com/sinhong2011/TraderMemos/commit/13b292b14606a4822fcf9507fb36f0d56b483ae9))

## [0.5.0](https://github.com/sinhong2011/TraderMemos/compare/v0.4.2...v0.5.0) (2026-08-06)


### Features

* account-level preferences synced across devices ([#114](https://github.com/sinhong2011/TraderMemos/issues/114)) ([a55c93f](https://github.com/sinhong2011/TraderMemos/commit/a55c93f58e8b9f17da3b93bec02c1154da97c12b))
* accounts, two-factor, token activity, and user administration ([#113](https://github.com/sinhong2011/TraderMemos/issues/113)) ([8b418f7](https://github.com/sinhong2011/TraderMemos/commit/8b418f7698984288cef9ac1694c6dae059a7d756))
* **mobile:** appearance setting, settings reorganisation, and trade preview ([#109](https://github.com/sinhong2011/TraderMemos/issues/109)) ([b8c3852](https://github.com/sinhong2011/TraderMemos/commit/b8c38525d9938be54a0faa2c7b852926b100f490))
* **mobile:** star ratings and a folded trades filter menu ([#106](https://github.com/sinhong2011/TraderMemos/issues/106)) ([c4fff6c](https://github.com/sinhong2011/TraderMemos/commit/c4fff6c47b6956a1e4044103ef67fc5e3900b2eb))


### Bug Fixes

* follow-ups from testing on a device ([#115](https://github.com/sinhong2011/TraderMemos/issues/115)) ([9ed0e3c](https://github.com/sinhong2011/TraderMemos/commit/9ed0e3c96485a975f6b46024ca6d159f477124c4))

## [0.4.2](https://github.com/sinhong2011/TraderMemos/compare/v0.4.1...v0.4.2) (2026-08-06)


### Bug Fixes

* **ci:** stop passing --what-to-test — EAS gates changelog behind Enterprise ([#104](https://github.com/sinhong2011/TraderMemos/issues/104)) ([af3f7b4](https://github.com/sinhong2011/TraderMemos/commit/af3f7b40f831946e81c3cd0c229c7e1a34dccc17))

## [0.4.1](https://github.com/sinhong2011/TraderMemos/compare/v0.4.0...v0.4.1) (2026-08-06)


### Bug Fixes

* **ci:** let a dispatched EAS build carry a release version ([#102](https://github.com/sinhong2011/TraderMemos/issues/102)) ([fb3c2bf](https://github.com/sinhong2011/TraderMemos/commit/fb3c2bfcda2e827196d9d743f1f4f40d28732211))
* **mobile:** unblock the EAS build's eas-cli install ([#100](https://github.com/sinhong2011/TraderMemos/issues/100)) ([c4bd8d4](https://github.com/sinhong2011/TraderMemos/commit/c4bd8d4584afbc9abb42681a5625723b93233200))

## [0.4.0](https://github.com/sinhong2011/TraderMemos/compare/v0.3.0...v0.4.0) (2026-08-05)


### Features

* **mobile:** checklist, replay, note images, day review and the SDK 57 bumps ([#99](https://github.com/sinhong2011/TraderMemos/issues/99)) ([06bd1b4](https://github.com/sinhong2011/TraderMemos/commit/06bd1b42eeaea55355413ba90aa4edcec31e49a2))
* **web:** customizable keyboard shortcuts + fix chords firing while typing ([#90](https://github.com/sinhong2011/TraderMemos/issues/90)) ([abf6e1a](https://github.com/sinhong2011/TraderMemos/commit/abf6e1a7f849cb50c6d4d3290ff67c1485559a39))


### Bug Fixes

* **marketing:** default siteUrl to the production origin ([#92](https://github.com/sinhong2011/TraderMemos/issues/92)) ([a21bd56](https://github.com/sinhong2011/TraderMemos/commit/a21bd56162dd198f1dc9c98039eaeb73af0d0d85))
* **mobile:** drop the abstract base build profile ([#94](https://github.com/sinhong2011/TraderMemos/issues/94)) ([93c94a4](https://github.com/sinhong2011/TraderMemos/commit/93c94a4ca42a8bc3a5af11da7eaa277a3cf56e0b))
* stop double-counting the opening balance in equity ([#95](https://github.com/sinhong2011/TraderMemos/issues/95)) ([63bcbe1](https://github.com/sinhong2011/TraderMemos/commit/63bcbe15e4015d1bd0fed43d567dfc5bd4e2cbfd))
* **web:** keep pinned table cells opaque on row hover ([#93](https://github.com/sinhong2011/TraderMemos/issues/93)) ([9dfef08](https://github.com/sinhong2011/TraderMemos/commit/9dfef086c2034dd04e33526d3946f120c3af8a12))

## [0.3.0](https://github.com/sinhong2011/TraderMemos/compare/v0.2.0...v0.3.0) (2026-08-04)


### Features

* docker healthchecks, reset-password CLI, import-cap fix, repo hygiene ([#84](https://github.com/sinhong2011/TraderMemos/issues/84)) ([84c12d4](https://github.com/sinhong2011/TraderMemos/commit/84c12d45eb6d1a222644f2542fb2ff6219ae86a9))
* **marketing:** Next.js + Fumadocs marketing and docs site ([#85](https://github.com/sinhong2011/TraderMemos/issues/85)) ([ad4661f](https://github.com/sinhong2011/TraderMemos/commit/ad4661fffbcb4aebb3d7459d3c09124021253af0))

## [0.2.0](https://github.com/sinhong2011/TraderMemos/compare/v0.1.13...v0.2.0) (2026-08-03)


### Features

* **mobile:** advanced chart and bar-by-bar trade replay ([#75](https://github.com/sinhong2011/TraderMemos/issues/75)) ([f78910f](https://github.com/sinhong2011/TraderMemos/commit/f78910f3c7cf5934a0ad267d612219aa35adbec5))
* **mobile:** foundation — display prefs, account scope, FX, full API types ([#68](https://github.com/sinhong2011/TraderMemos/issues/68)) ([9aa71ef](https://github.com/sinhong2011/TraderMemos/commit/9aa71ef58031552a5e0068d4dee1530861e4fa83))
* **mobile:** native iOS app — Expo SDK 57 development build ([#67](https://github.com/sinhong2011/TraderMemos/issues/67)) ([b75af88](https://github.com/sinhong2011/TraderMemos/commit/b75af88c84dd9a65b559232c174a9552d7144040))
* **mobile:** Notes, Playbook, economic calendar, P&L heatmap, Year Wrapped ([#71](https://github.com/sinhong2011/TraderMemos/issues/71)) ([52c4b26](https://github.com/sinhong2011/TraderMemos/commit/52c4b263c450114bf9541665bd4c3c2e365f9262))
* **mobile:** open the trade form on files dropped by a Shortcut ([#80](https://github.com/sinhong2011/TraderMemos/issues/80)) ([cfadedf](https://github.com/sinhong2011/TraderMemos/commit/cfadedfab3022aa9e330dd27f8e8c1ef0c70f996))
* **mobile:** P&L heatmap moves into Reports Detailed, cell tap opens a details sheet ([#78](https://github.com/sinhong2011/TraderMemos/issues/78)) ([882a2e2](https://github.com/sinhong2011/TraderMemos/commit/882a2e2f95fdb0749d3e2adcc1b820e93aa5878e))
* **mobile:** prop evaluation, daily-loss limit, and IBKR Flex sync ([#74](https://github.com/sinhong2011/TraderMemos/issues/74)) ([1a433b8](https://github.com/sinhong2011/TraderMemos/commit/1a433b80f9b870855e8f8ebced86d87b1e9e86a2))
* **mobile:** Reports — Detailed, Risk, and Behavior sections ([#70](https://github.com/sinhong2011/TraderMemos/issues/70)) ([23e7a83](https://github.com/sinhong2011/TraderMemos/commit/23e7a83d4ed06a5f3ecfffbf5dc32b24cb15a4ba))
* **mobile:** Reports tab — Overview and Win/Loss analytics ([#69](https://github.com/sinhong2011/TraderMemos/issues/69)) ([4110aff](https://github.com/sinhong2011/TraderMemos/commit/4110aff1001ca8312694ecd0c4c27d3e3883e5d7))
* **mobile:** trade detail — coach, attachments, share card, excursion ([#73](https://github.com/sinhong2011/TraderMemos/issues/73)) ([804a278](https://github.com/sinhong2011/TraderMemos/commit/804a278a734a58c47b771f9d5953f9a446af97de))
* **mobile:** trader tools — position size, Kelly, FX converter, R calculator ([#72](https://github.com/sinhong2011/TraderMemos/issues/72)) ([dfd5eb2](https://github.com/sinhong2011/TraderMemos/commit/dfd5eb2cef546fde076994614d796afeef11b5be))
* **web:** CSV/JSON file import prefills the New Trade form ([#82](https://github.com/sinhong2011/TraderMemos/issues/82)) ([4e120a8](https://github.com/sinhong2011/TraderMemos/commit/4e120a8cc5d8fa986f0ff8109c6e55a1a62c4420))
* **web:** move P&L heatmap into Reports, add hover tooltips + cell drill-down ([#76](https://github.com/sinhong2011/TraderMemos/issues/76)) ([e1163c4](https://github.com/sinhong2011/TraderMemos/commit/e1163c401b2297dc229420e74b45ad3c48d95e68))


### Bug Fixes

* **api:** drop duplicate "time" key from JSON log lines ([#79](https://github.com/sinhong2011/TraderMemos/issues/79)) ([555b36c](https://github.com/sinhong2011/TraderMemos/commit/555b36cb4c41be542545aa8e9579449088cad768))
* **api:** log error causes on request lines, panics via slog, numeric latency ([#81](https://github.com/sinhong2011/TraderMemos/issues/81)) ([e71befd](https://github.com/sinhong2011/TraderMemos/commit/e71befdc49bb518550a486bb496e993133a37b27))
* **web:** file trade days under the market timezone everywhere ([#77](https://github.com/sinhong2011/TraderMemos/issues/77)) ([fce7a54](https://github.com/sinhong2011/TraderMemos/commit/fce7a54d366bb00098f9750ef221a3175a807e13))

## [0.1.13](https://github.com/sinhong2011/TraderMemos/compare/v0.1.12...v0.1.13) (2026-08-03)


### Features

* **web:** advanced chart — standalone market chart for any symbol ([#61](https://github.com/sinhong2011/TraderMemos/issues/61)) ([c604148](https://github.com/sinhong2011/TraderMemos/commit/c6041481f618fa0eb570b9b2f0b135d3aace7cc0))
* **web:** currency converter tool — live FX modal ([#64](https://github.com/sinhong2011/TraderMemos/issues/64)) ([7e4a15c](https://github.com/sinhong2011/TraderMemos/commit/7e4a15ce75a90d88e4783b3c41b23fb713789d68))
* **web:** personal P&L heatmap tool; drop Technical rating ([#62](https://github.com/sinhong2011/TraderMemos/issues/62)) ([f327677](https://github.com/sinhong2011/TraderMemos/commit/f327677dd1d426a2fc3096a7440dceb710fa3227))
* **web:** Year Wrapped share card ([#57](https://github.com/sinhong2011/TraderMemos/issues/57)) ([fe50bd8](https://github.com/sinhong2011/TraderMemos/commit/fe50bd8cba7a3d612adec270174e328c2035268f))


### Bug Fixes

* **web:** clearer trade replay readout — Closed label + price-mismatch hint ([#58](https://github.com/sinhong2011/TraderMemos/issues/58)) ([e7b22f1](https://github.com/sinhong2011/TraderMemos/commit/e7b22f1ca0c17da4e451650c2484924743998ba2))
* **web:** one-row events toolbar, wider 12h time column, legible calendar labels ([#65](https://github.com/sinhong2011/TraderMemos/issues/65)) ([3974285](https://github.com/sinhong2011/TraderMemos/commit/3974285f6fadf4c0116f457c3439f43e612d6e70))
* **web:** Tools menu — remove Wallet, wire Economic calendar and Trade planner ([#59](https://github.com/sinhong2011/TraderMemos/issues/59)) ([76a1db1](https://github.com/sinhong2011/TraderMemos/commit/76a1db1d2b2548f86092dab93f1d79d1e08eebcb))

## [0.1.12](https://github.com/sinhong2011/TraderMemos/compare/v0.1.11...v0.1.12) (2026-08-02)


### Features

* Kelly %, SQN, and mean/median toggle for Reports ([#48](https://github.com/sinhong2011/TraderMemos/issues/48)) ([992407d](https://github.com/sinhong2011/TraderMemos/commit/992407dce9ca2a5d9a6285026e9d5a968e780f23))
* **web:** opt-in trade share cards — private-by-default PNG export ([#50](https://github.com/sinhong2011/TraderMemos/issues/50)) ([da1d885](https://github.com/sinhong2011/TraderMemos/commit/da1d88508d1ec7b5348890ab0a03fc0efd4efd20))
* **web:** setting to disable the update notification toast ([#46](https://github.com/sinhong2011/TraderMemos/issues/46)) ([d7d1d25](https://github.com/sinhong2011/TraderMemos/commit/d7d1d25a01b298a9e72c184dfb6e2651f1d5fd19))
* **web:** Year Wrapped — annual trading recap page ([#49](https://github.com/sinhong2011/TraderMemos/issues/49)) ([a4b7428](https://github.com/sinhong2011/TraderMemos/commit/a4b7428276eaefc1a88442b328c13bd45ce89e05))


### Bug Fixes

* make the Reports gross P&L toggle real — add before-fees gross_pnl ([#52](https://github.com/sinhong2011/TraderMemos/issues/52)) ([ecd8f6e](https://github.com/sinhong2011/TraderMemos/commit/ecd8f6e1bba1e94953a16bcbe6f61c8e42d95146))
* trading days follow the market timezone — end-to-end date pipeline fix ([#53](https://github.com/sinhong2011/TraderMemos/issues/53)) ([cc91028](https://github.com/sinhong2011/TraderMemos/commit/cc910286f53cce12ce315c0eadf8d931d7dc917b))
* **web:** rule-compliance breach dates render a day early west of UTC ([#51](https://github.com/sinhong2011/TraderMemos/issues/51)) ([73e5615](https://github.com/sinhong2011/TraderMemos/commit/73e561517f03a18d95ab4677f65d68175c295e7a))
* **web:** Year Wrapped reports link missing required avg search param ([#55](https://github.com/sinhong2011/TraderMemos/issues/55)) ([d216874](https://github.com/sinhong2011/TraderMemos/commit/d2168746ad6ca36fc7719a25027cb9ac17ed381c))

## [0.1.11](https://github.com/sinhong2011/TraderMemos/compare/v0.1.10...v0.1.11) (2026-08-02)


### Features

* post-exit MAE/MFE — measure the move after the exit ([#44](https://github.com/sinhong2011/TraderMemos/issues/44)) ([391e9ef](https://github.com/sinhong2011/TraderMemos/commit/391e9efe75972ccf92ba29a7ac55dfcad7d646ca))
* version boot logging, /system/info endpoint, and web/API mismatch banner ([#47](https://github.com/sinhong2011/TraderMemos/issues/47)) ([d22d6b9](https://github.com/sinhong2011/TraderMemos/commit/d22d6b95f7c2f165c7c11af1e656cb48e1b1ae5d))

## [0.1.10](https://github.com/sinhong2011/TraderMemos/compare/v0.1.9...v0.1.10) (2026-08-02)


### Features

* auto-compute MAE/MFE from market bars ([#33](https://github.com/sinhong2011/TraderMemos/issues/33)) ([c3aaa61](https://github.com/sinhong2011/TraderMemos/commit/c3aaa61f9de5aed570219580ff414aded81f97ab))
* behavioral analytics — revenge, overconfidence, loss aversion detection ([#39](https://github.com/sinhong2011/TraderMemos/issues/39)) ([1714326](https://github.com/sinhong2011/TraderMemos/commit/17143267718189214176d8a37b1844bf6b6067ff))
* economic calendar — ForexFactory feed + week-timeline events page ([#36](https://github.com/sinhong2011/TraderMemos/issues/36)) ([895cff0](https://github.com/sinhong2011/TraderMemos/commit/895cff007c012566393a83188636d3035bb071a5))
* IBKR Flex auto-sync — scheduled broker import via Flex Web Service ([#41](https://github.com/sinhong2011/TraderMemos/issues/41)) ([ffd4985](https://github.com/sinhong2011/TraderMemos/commit/ffd49852db20f71b5d0c32b8ef563747d0807b11))
* in-process background job runner with MAE/MFE excursion backfill ([#40](https://github.com/sinhong2011/TraderMemos/issues/40)) ([fe0c548](https://github.com/sinhong2011/TraderMemos/commit/fe0c5488495b68e906e0be92fa222f9dc8dc6f50))
* pro day-trader suite — rule compliance, day review, broker presets, prop mode ([#38](https://github.com/sinhong2011/TraderMemos/issues/38)) ([0fa4ce2](https://github.com/sinhong2011/TraderMemos/commit/0fa4ce24871852ff1dfb2427cb0da61c6f784d23))
* **web:** replace app icon with new blue candlestick T artwork ([#42](https://github.com/sinhong2011/TraderMemos/issues/42)) ([cdc0970](https://github.com/sinhong2011/TraderMemos/commit/cdc09707d224499346afa6a09251a4b3d1559aac))
* **web:** trade replay — bar-by-bar playback on the trade chart ([#43](https://github.com/sinhong2011/TraderMemos/issues/43)) ([11190e0](https://github.com/sinhong2011/TraderMemos/commit/11190e0de267a93cdf484736109e4f2829a3f8b5))

## [0.1.9](https://github.com/sinhong2011/TraderMemos/compare/v0.1.8...v0.1.9) (2026-08-01)


### Features

* **web:** replace the hand-drawn app icon with new raster artwork ([#16](https://github.com/sinhong2011/TraderMemos/issues/16)) ([4a009f1](https://github.com/sinhong2011/TraderMemos/commit/4a009f19888b884e3287a021f9130f08afc1c767))


### Bug Fixes

* **ci:** let the PR title check report on bot-created Release PRs ([#31](https://github.com/sinhong2011/TraderMemos/issues/31)) ([6748660](https://github.com/sinhong2011/TraderMemos/commit/67486605ba32d5ae24832632d2fe5d0acb0a1b91))
* **ci:** publish semver Docker tags and time-limit image builds ([#30](https://github.com/sinhong2011/TraderMemos/issues/30)) ([e42b3fb](https://github.com/sinhong2011/TraderMemos/commit/e42b3fb901f048390af42049a1bd9042efa58d40))
* correct futures P&L multipliers and bucket analytics on the trader's clock ([#18](https://github.com/sinhong2011/TraderMemos/issues/18)) ([4177046](https://github.com/sinhong2011/TraderMemos/commit/4177046828a1b98d00cbe440c93a42450bda2a52))
* **web:** persist update-toast dismissal per release ([#17](https://github.com/sinhong2011/TraderMemos/issues/17)) ([2a8ad32](https://github.com/sinhong2011/TraderMemos/commit/2a8ad328b6605ff7e0909325c82c6902c2a8fe9e))

## [0.1.8](https://github.com/sinhong2011/TraderMemos/compare/v0.1.7...v0.1.8) (2026-08-01)


### Bug Fixes

* **web:** pin the clock in DateRangePicker tests ([#14](https://github.com/sinhong2011/TraderMemos/issues/14)) ([6240556](https://github.com/sinhong2011/TraderMemos/commit/6240556b2cb8c70d3d8b9d13aa21aebfb28eef71))

## [0.1.7](https://github.com/sinhong2011/TraderMemos/compare/v0.1.6...v0.1.7) (2026-08-01)


### Documentation

* rebuild the README around product screenshots ([#12](https://github.com/sinhong2011/TraderMemos/issues/12)) ([2fa2c4d](https://github.com/sinhong2011/TraderMemos/commit/2fa2c4d92ad1061fd1378b4fa80cbbb448622d89))

## [0.1.6](https://github.com/sinhong2011/TraderMemos/compare/v0.1.5...v0.1.6) (2026-07-30)


### Bug Fixes

* green the Test API and Test web CI jobs ([#10](https://github.com/sinhong2011/TraderMemos/issues/10)) ([f814488](https://github.com/sinhong2011/TraderMemos/commit/f814488b4d3e019d66e718fcbbb9e7787e83ba78))

## [0.1.5](https://github.com/sinhong2011/TraderMemos/compare/v0.1.4...v0.1.5) (2026-07-30)


### Features

* **web:** rebuild the UI on shadcn/ui + coss ui ([#8](https://github.com/sinhong2011/TraderMemos/issues/8)) ([da3f74b](https://github.com/sinhong2011/TraderMemos/commit/da3f74b347344d18ce7caf4dec13d376d6870c77))

## [0.1.4](https://github.com/sinhong2011/TraderMemos/compare/v0.1.3...v0.1.4) (2026-07-23)


### Bug Fixes

* **web:** unblock Cloudflare Workers deploy SPA redirects ([d1d8b9d](https://github.com/sinhong2011/TraderMemos/commit/d1d8b9d933b071080e1a95b2721ab78a1719d94d))

## [0.1.3](https://github.com/sinhong2011/TraderMemos/compare/v0.1.2...v0.1.3) (2026-07-23)


### Bug Fixes

* **ci:** align healthz and settings tests with current behavior ([dcbd6d0](https://github.com/sinhong2011/TraderMemos/commit/dcbd6d0d3e420a0b8f4517658f815f6e57dc240e))

## [0.1.2](https://github.com/sinhong2011/TraderMemos/compare/v0.1.1...v0.1.2) (2026-07-23)


### Features

* **api:** add optional Postgres backend beside SQLite ([2bb1c17](https://github.com/sinhong2011/TraderMemos/commit/2bb1c177bf7adc5b28c832e0df58e405363c7e47))
* **api:** export Call/Put on journal CSV from fill details ([6aace51](https://github.com/sinhong2011/TraderMemos/commit/6aace518dce762c8908a6fdeb808f72851eb8d38))
* **api:** make import preview parse-only and skip orphan journal exits ([bbd9e6b](https://github.com/sinhong2011/TraderMemos/commit/bbd9e6be6677916068a6e571e4016c06b687de90))
* **api:** unify database config on TM_DATABASE_URL ([fc5af2a](https://github.com/sinhong2011/TraderMemos/commit/fc5af2a9f79382e4b9d68445cc65a34eb23ff498))
* **docker:** pull Hub images by default with build override ([49e207a](https://github.com/sinhong2011/TraderMemos/commit/49e207af2706c591c02a29d92aa16669230657f6))
* **web:** add Dir column with LC/LP/SC/SP option tags ([a5e18ce](https://github.com/sinhong2011/TraderMemos/commit/a5e18ce2fccb63b697d3f85b9d3080f75f745646))
* **web:** stage import edits client-side and confirm via /imports/commit ([2f55b80](https://github.com/sinhong2011/TraderMemos/commit/2f55b80050088f58d5f55a74b9ffa5e0beb947f6))


### Bug Fixes

* **api:** expand Postgres slice params for trade delete queries ([eb80105](https://github.com/sinhong2011/TraderMemos/commit/eb80105dd83883715628c5eb384ff2d2e2109d3f))
* **api:** soften option_right partitioning when regrouping fills ([58d9e6f](https://github.com/sinhong2011/TraderMemos/commit/58d9e6f82137e6b1ea226fac20272b2aad6773db))

## [0.1.1](https://github.com/sinhong2011/TraderMemos/compare/v0.1.0...v0.1.1) (2026-07-23)


### Features

* **api:** add media files store and harden trade attachments ([04fc880](https://github.com/sinhong2011/TraderMemos/commit/04fc880862e44cedfc933678baa53dbef07c4539))
* **api:** first-user setup, admin flag, and auth hardening ([26a376d](https://github.com/sinhong2011/TraderMemos/commit/26a376d95459ede55e1b55e36709a5dadf279c12))
* **api:** JSON/CSV export and JSON import ([94d3139](https://github.com/sinhong2011/TraderMemos/commit/94d31391e9f71b93bbf3092048f8d40cd0aa1e2d))
* **api:** LLM trade coach endpoint ([d79bd39](https://github.com/sinhong2011/TraderMemos/commit/d79bd39861b9e8e0b1b6313e2cc7c90c4fcad876))
* **api:** note symbols, checklist content, and note types ([269cdab](https://github.com/sinhong2011/TraderMemos/commit/269cdabd37e6ebe342294406dfb7f0302b6bc64e))
* **api:** personal access tokens (PAT) ([99e935c](https://github.com/sinhong2011/TraderMemos/commit/99e935c28e5cdde9082f55edb02ded31c2870543))
* **api:** seed opening deposits and allow account/cash updates ([d2bd0f9](https://github.com/sinhong2011/TraderMemos/commit/d2bd0f924fee300dc11995c45f37f5dd72b4f785))
* **api:** serve OpenAPI docs ([309bf88](https://github.com/sinhong2011/TraderMemos/commit/309bf888b9786cb44c751693a56da71458149b58))
* **api:** zip account export with attachment files ([fef2a01](https://github.com/sinhong2011/TraderMemos/commit/fef2a01c8b7a940062508b0f9fd3c324e0f216de))
* **web:** add TipTap SignalEditor for markdown notes ([00db118](https://github.com/sinhong2011/TraderMemos/commit/00db118731010c6bf2fa5b7ce16c2e8d7d257fce))
* **web:** extract DayTradesDrawer for calendar and reports ([d749edf](https://github.com/sinhong2011/TraderMemos/commit/d749edfe57c917342f735becbee2287b6e35d00c))
* **web:** Import/Export UI for CSV and JSON ([39baf23](https://github.com/sinhong2011/TraderMemos/commit/39baf23a4d38c71682c59f5a1f71582d509d49f3))
* **web:** media-backed TipTap images, trade gallery, and ZIP export ([4ea2022](https://github.com/sinhong2011/TraderMemos/commit/4ea2022727cb65d4880fcfaaa795e371d2fbeca6))
* **web:** multi-symbol filters and header account switcher ([5840c98](https://github.com/sinhong2011/TraderMemos/commit/5840c9896c14f87d931c7284e1a364a26f22fc1d))
* **web:** Notes page with note and daily-log layouts ([a10063c](https://github.com/sinhong2011/TraderMemos/commit/a10063ca67e60a578cd0393f8999a3e85b7a29bb))
* **web:** polish calendar day hover details ([4dcf0ad](https://github.com/sinhong2011/TraderMemos/commit/4dcf0ada803d8a50a07bc4c499fdb3981c832dd6))
* **web:** Settings API/About tabs and app config ([3cada74](https://github.com/sinhong2011/TraderMemos/commit/3cada74d91a71000bfd8cb08dcc423d2ed42f23c))
* **web:** setup wizard, gated sign-in, and update banner ([421ecce](https://github.com/sinhong2011/TraderMemos/commit/421ecce041d7fe33dbf22a9ece7b14f9ca79159e))
* **web:** TipTap checklist and risk rule defs in Settings ([4ba0225](https://github.com/sinhong2011/TraderMemos/commit/4ba02255679e76ac359e69bf9713b636123f5ab9))


### Bug Fixes

* **api:** recover dirty migrations and stop air racing SQL ([5c03efe](https://github.com/sinhong2011/TraderMemos/commit/5c03efe25b67ded9b4a9ea85b29ac0b7e91d9880))
* **ci:** unbreak web lint and importer fixture tests ([6e09d51](https://github.com/sinhong2011/TraderMemos/commit/6e09d51bf344dca8a0dc0669675fe3fe7bcd3088))
* **web:** soften DataTable pin edges and drop dashboard pin ([5f83040](https://github.com/sinhong2011/TraderMemos/commit/5f830401736d53eee569f6f315ca3fc5c98f547f))
* **web:** stabilize CI unit tests for compact money and tabs ([4f4bf18](https://github.com/sinhong2011/TraderMemos/commit/4f4bf18a7cf8fe64fecd91a6d688dae7888c49c4))
* **web:** stop format fighting TanStack routeTree.gen.ts ([d400924](https://github.com/sinhong2011/TraderMemos/commit/d400924ad8fd0e256b410810ade77c7b5139c3be))

## [0.1.0](https://github.com/sinhong2011/TraderMemos/releases/tag/v0.1.0) (2026-07-22)

### Features

* Go API with SQLite, JWT auth, and trading journal endpoints
* React web app (Signal Terminal UI) with dashboard, trade log, calendar, and reports
* Docker images for self-hosted deployment (`tradermemos-api`, `tradermemos-web`)
* In-app update checks against GitHub Releases
