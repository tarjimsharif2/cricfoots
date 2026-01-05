-- Drop the existing check constraint
ALTER TABLE streaming_servers DROP CONSTRAINT IF EXISTS streaming_servers_player_type_check;

-- Add new check constraint that includes hlsjs_proxy
ALTER TABLE streaming_servers ADD CONSTRAINT streaming_servers_player_type_check 
CHECK (player_type IS NULL OR player_type IN ('hls', 'clappr', 'hlsjs_proxy'));

-- Also update saved_streaming_servers if it has the same constraint
ALTER TABLE saved_streaming_servers DROP CONSTRAINT IF EXISTS saved_streaming_servers_player_type_check;

ALTER TABLE saved_streaming_servers ADD CONSTRAINT saved_streaming_servers_player_type_check 
CHECK (player_type IS NULL OR player_type IN ('hls', 'clappr', 'hlsjs_proxy'));