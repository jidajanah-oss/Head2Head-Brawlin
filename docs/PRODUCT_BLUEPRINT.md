# Head2Head Brawlin 2026 – Production Blueprint

## Purpose
Build a production-ready NFL Pick'em league app based on the V3.6 baseline.

## League Type
Weekly NFL Pick'em league, not fantasy football.

## Player Capacity
- Supports up to 32 players.
- Players can be added, edited, removed, or marked inactive by the commissioner.

## Core Rules
- Win = 3 points.
- Tie = 1 point.
- Loss = 0 points.
- No tiebreaker.
- Each game pick locks 5 minutes before that game's scheduled kickoff.
- Missed deadline triggers Picker Clicker picks.
- Auto Picker Clicker weeks do not count toward eligible season correct picks.

## Main Screens
- Dashboard
- Pick Sheet
- Game Center
- Standings
- Everyone's Picks
- Matchups
- Schedule
- Playoffs
- Payouts
- Stats Center
- League History
- Rulebook
- Logo Gallery
- Commissioner Center

## Commissioner Center
The commissioner can:
- Add/edit/remove players.
- Assign NFL teams.
- Manage weekly pick status.
- View all submitted picks.
- Edit scores if needed.
- Manage rules.
- Manage payouts.
- Manage league announcements.

## Database Plan
Future Firebase collections:
- leagueSettings
- players
- nflTeams
- nflSchedule
- weeklyPicks
- weeklyResults
- standings
- payouts
- announcements
- history

## Build Principle
Do not add generic fantasy football features unless specifically requested.