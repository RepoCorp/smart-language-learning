# Admin weekly session study time

The registered-users consumption summary includes session study minutes from
existing `DailyLearningProgress.active_seconds` records. Sum the daily totals
across all study languages, then divide by 60 and display whole minutes. Users
with no recorded time in the window show zero.

Use the same Monday-through-today date window as the existing admin AI usage
summary. Its boundaries use the requesting admin's active timezone; daily progress
dates were recorded in each learner's timezone. This is a date-based report, not
a reconstruction of activity timestamps across timezones.

The counter reflects time reported by the existing session activity tracker,
not all time spent in the application. Live conversation minutes remain separate.
No extra tracking, schema changes, quota changes, or historical estimates are
introduced. A separate grouped query avoids multiplying totals through joins to
AI usage records and avoids one query per user.

Tests: `backend/tests/test_admin_study_usage.py` and
`frontend/tests/adminStudyUsage.test.tsx`.
