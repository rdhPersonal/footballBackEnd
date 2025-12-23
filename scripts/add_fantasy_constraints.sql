-- Add unique constraints for proper upsert logic in fantasy tables

-- League table: unique on espn_league_id + season
ALTER TABLE league 
ADD CONSTRAINT unique_league_espn_season 
UNIQUE (espn_league_id, season);

-- Fantasy teams table: unique on league_id + espn_team_id  
ALTER TABLE fantasy_teams 
ADD CONSTRAINT unique_team_league_espn 
UNIQUE (league_id, espn_team_id);

-- Roster entries table: unique on fantasy_team_id + player_id + acquired_date
ALTER TABLE roster_entries 
ADD CONSTRAINT unique_roster_team_player_date 
UNIQUE (fantasy_team_id, player_id, acquired_date);

-- Show the constraints we just added
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name 
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE' 
    AND tc.table_name IN ('league', 'fantasy_teams', 'roster_entries')
    AND tc.table_schema = 'public'
GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
ORDER BY tc.table_name, tc.constraint_name;