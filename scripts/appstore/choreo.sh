#!/bin/bash
# App Preview choreography. Runs while simctl records the display.
# Coordinates are POINTS on the 17 Pro Max (440x956).
SP="$(cd "$(dirname "$0")" && pwd)"
U="$SP/simctl.sh"

sleep 2.0                       # 0.0  hold on Home / equity curve

$U swipe 220 700 220 470 0.9 >/dev/null   # 2.0  ease down the dashboard
sleep 1.6
$U swipe 220 700 220 480 0.9 >/dev/null
sleep 1.8

$U tap 172 913 >/dev/null       # 7.0  Trades tab
sleep 2.4
$U swipe 220 720 220 400 0.9 >/dev/null   # scroll the blotter
sleep 1.8

$U tap 220 500 >/dev/null       # 12.0 open a trade
sleep 2.6
$U swipe 220 760 220 300 0.9 >/dev/null   # down to plan & risk / chart
sleep 1.6
$U swipe 220 760 220 300 0.9 >/dev/null   # down to the coach panel
sleep 2.4

$U tap 20 41 >/dev/null         # 21.0 back to the blotter
sleep 1.6

$U tap 267 913 >/dev/null       # 23.0 Calendar tab
sleep 1.2
$U tap 358 84 >/dev/null        # step back to a month with trades
sleep 2.6

$U url "tradermemos://reports" >/dev/null # 27.5 Reports
sleep 2.6
$U tap 219 184 >/dev/null       # Detailed tab — symbol treemap
sleep 3.0
