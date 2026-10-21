# Homepage review — October 20, 2026 (EDT)

## Live findings

- The dispatcher warning was accurate. At 11:22 PM EDT, the last successful live run was 8:52 PM EDT. The workflow was active, main was the default branch, and recent dispatch runs succeeded. Scheduled starts were hours apart despite a 15-minute cron definition. The run data shows missing/delayed starts, not recent job failures; the underlying GitHub scheduling cause is not proven. [GitHub documents schedule delays and dropped jobs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule). A separate authenticated trigger would be needed for stronger scheduling guarantees. This review did not invoke live publishing or alter the cron.
- The calendar comparison was noisy: both current events matched the calendar title, times, and location. Only social descriptions differed. Bar Social had a blank calendar description and a deliberately detailed campaign caption. The existing checker compared campaign copy directly to calendar copy and called this a source change.
- Bar Social had a day-1 feed snapshot recorded October 20 at 8:04 PM EDT: 17 likes, reach 191, saves 0. Snapshot collection stores cumulative metrics around feed days 1 and 7; it does not poll live counts. Existing archive/details consumed these records, but homepage cards did not.

## Local changes

Campaign cards now show the latest recorded Feed likes and reach, the capture time, timezone, and an explicit snapshot label. Unpublished campaigns show a placeholder instead of a misleading zero. Snapshot selection ignores Story metrics and snapshots for another current media ID. Archive counts, details, and reach comparisons use the same selection.

The calendar refresh compares new campaigns with a stored original source snapshot, distinguishing edited campaign wording from later source changes. For older campaigns with no baseline, customized descriptions do not generate source-change alerts; title, dates, and location still do. Structured comparisons show saved campaign and calendar values without applying edits. Old comparison records remain clearly labeled until the next calendar sync refreshes them.

The dispatcher controls explain that the heartbeat is expected even when no messages are due and that stale health does not itself prove a post failed. The real stale warning remains visible.

Validation includes unit tests for counts, timestamps, current media selection, calendar baselines, legacy copy, and the complete calendar refresh; desktop/mobile and both-theme browser checks verify layout and review flows using isolated fixtures. Real campaign files and recorded receipts were not edited by this review.
