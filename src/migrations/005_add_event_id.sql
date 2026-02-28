-- 005: Add event_id to player_stats for upstream traceability and replay safety.
-- event_id maps to the ESPN game event identifier and enables deduplication
-- at the source-event level if needed in the future.

ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS event_id VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_player_stats_event_id ON player_stats (event_id);
