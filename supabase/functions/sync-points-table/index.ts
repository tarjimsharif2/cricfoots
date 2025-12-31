import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to fetch with retry logic
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      lastError = error as Error;
      console.log(`Attempt ${attempt}/${maxRetries} failed: ${error}`);
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Failed to fetch after retries');
}

// Normalize team name for matching
const normalizeTeamName = (name: string): string => {
  return (name || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
};

// Flexible team name matching
const teamsMatch = (name1: string, name2: string): boolean => {
  const n1 = normalizeTeamName(name1);
  const n2 = normalizeTeamName(name2);
  
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;
  
  const words1 = n1.split(/\s+/).filter(w => w.length >= 3);
  const words2 = n2.split(/\s+/).filter(w => w.length >= 3);
  
  for (const w1 of words1) {
    for (const w2 of words2) {
      if (w1 === w2 || (w1.length >= 4 && w2.length >= 4 && (w1.includes(w2) || w2.includes(w1)))) {
        return true;
      }
    }
  }
  
  return false;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { tournamentId, leagueId } = body;

    if (!tournamentId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tournament ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync-points-table] Syncing points table for tournament: ${tournamentId}`);

    // Get the API key from site_settings
    const { data: settings, error: settingsError } = await supabase
      .from('site_settings')
      .select('api_cricket_key, api_cricket_enabled')
      .limit(1)
      .maybeSingle();

    if (settingsError || !settings?.api_cricket_enabled || !settings?.api_cricket_key) {
      console.error('[sync-points-table] API Cricket is disabled or not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'API Cricket is disabled or not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = settings.api_cricket_key;

    // Get tournament details
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, name, season')
      .eq('id', tournamentId)
      .single();

    if (tournamentError || !tournament) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tournament not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all teams in the system
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, short_name');

    if (teamsError || !teams) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch teams' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch standings from API - try to find by league name
    // First, get leagues list
    const leaguesUrl = `https://apiv2.api-cricket.com/cricket/?method=get_leagues&APIkey=${apiKey}`;
    
    console.log('[sync-points-table] Fetching leagues from API...');
    
    const leaguesResponse = await fetchWithRetry(leaguesUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!leaguesResponse.ok) {
      console.error('[sync-points-table] Failed to fetch leagues');
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch leagues from API' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const leaguesData = await leaguesResponse.json();
    
    if (!leaguesData.success || leaguesData.success !== 1) {
      console.error('[sync-points-table] API returned unsuccessful response');
      return new Response(
        JSON.stringify({ success: false, error: 'API returned unsuccessful response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const leagues = leaguesData.result || [];
    console.log(`[sync-points-table] Found ${leagues.length} leagues`);

    // Find matching league by tournament name
    let targetLeagueId = leagueId;
    
    if (!targetLeagueId) {
      const tournamentNameLower = normalizeTeamName(tournament.name);
      const matchingLeague = leagues.find((league: any) => {
        const leagueNameLower = normalizeTeamName(league.league_name || '');
        return leagueNameLower.includes(tournamentNameLower) || 
               tournamentNameLower.includes(leagueNameLower) ||
               leagueNameLower.split(' ').some((word: string) => 
                 word.length >= 3 && tournamentNameLower.includes(word)
               );
      });
      
      if (matchingLeague) {
        targetLeagueId = matchingLeague.league_key;
        console.log(`[sync-points-table] Found matching league: ${matchingLeague.league_name} (${targetLeagueId})`);
      }
    }

    if (!targetLeagueId) {
      // Return available leagues for user to select
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No matching league found. Please select a league.',
          availableLeagues: leagues.map((l: any) => ({
            id: l.league_key,
            name: l.league_name,
            country: l.country_name || '',
          }))
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch standings for the league
    const standingsUrl = `https://apiv2.api-cricket.com/cricket/?method=get_standings&league_id=${targetLeagueId}&APIkey=${apiKey}`;
    
    console.log(`[sync-points-table] Fetching standings for league: ${targetLeagueId}`);
    
    const standingsResponse = await fetchWithRetry(standingsUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!standingsResponse.ok) {
      console.error('[sync-points-table] Failed to fetch standings');
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch standings from API' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const standingsData = await standingsResponse.json();
    
    if (!standingsData.success || standingsData.success !== 1) {
      console.error('[sync-points-table] API returned unsuccessful standings response');
      return new Response(
        JSON.stringify({ success: false, error: 'API returned unsuccessful standings response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const standings = standingsData.result?.total || standingsData.result || [];
    console.log(`[sync-points-table] Found ${standings.length} teams in standings`);

    if (!standings || standings.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No standings data available' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current points table entries to preserve NRR
    const { data: existingEntries, error: existingError } = await supabase
      .from('tournament_points_table')
      .select('*')
      .eq('tournament_id', tournamentId);

    const existingNrrMap = new Map<string, number>();
    if (existingEntries) {
      existingEntries.forEach(entry => {
        existingNrrMap.set(entry.team_id, entry.net_run_rate || 0);
      });
    }

    let updatedCount = 0;
    let insertedCount = 0;

    // Process each team in standings
    for (const standing of standings) {
      const apiTeamName = standing.team_name || standing.standing_team || '';
      
      if (!apiTeamName) continue;

      // Find matching team in our database
      const matchingTeam = teams.find(team => 
        teamsMatch(team.name, apiTeamName) || teamsMatch(team.short_name, apiTeamName)
      );

      if (!matchingTeam) {
        console.log(`[sync-points-table] No matching team found for: ${apiTeamName}`);
        continue;
      }

      console.log(`[sync-points-table] Matched ${apiTeamName} -> ${matchingTeam.name}`);

      // Parse standing data
      const played = parseInt(standing.standing_P || standing.played || standing.matches || 0) || 0;
      const won = parseInt(standing.standing_W || standing.won || standing.wins || 0) || 0;
      const lost = parseInt(standing.standing_L || standing.lost || standing.losses || 0) || 0;
      const tied = parseInt(standing.standing_T || standing.tied || standing.ties || 0) || 0;
      const noResult = parseInt(standing.standing_NR || standing.no_result || standing.nr || 0) || 0;
      const points = parseInt(standing.standing_PTS || standing.points || standing.pts || 0) || 0;
      const position = parseInt(standing.standing_place || standing.position || standing.rank || 0) || 0;

      // Preserve existing NRR - don't overwrite from API
      const existingNrr = existingNrrMap.get(matchingTeam.id) || 0;

      // Check if entry exists
      const { data: existing } = await supabase
        .from('tournament_points_table')
        .select('id, net_run_rate')
        .eq('tournament_id', tournamentId)
        .eq('team_id', matchingTeam.id)
        .maybeSingle();

      const entryData = {
        tournament_id: tournamentId,
        team_id: matchingTeam.id,
        position,
        played,
        won,
        lost,
        tied,
        no_result: noResult,
        points,
        // Keep existing NRR, don't replace from API
        net_run_rate: existing?.net_run_rate ?? existingNrr,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await supabase
          .from('tournament_points_table')
          .update(entryData)
          .eq('id', existing.id);
        
        if (!error) updatedCount++;
      } else {
        const { error } = await supabase
          .from('tournament_points_table')
          .insert(entryData);
        
        if (!error) insertedCount++;
      }
    }

    console.log(`[sync-points-table] Sync complete. Updated: ${updatedCount}, Inserted: ${insertedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Points table synced successfully`,
        updated: updatedCount,
        inserted: insertedCount,
        leagueId: targetLeagueId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[sync-points-table] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
