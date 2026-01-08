import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAdminAuth, unauthorizedResponse, forbiddenResponse } from '../_shared/auth.ts';

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

  // Verify admin authentication
  const { user, error: authError } = await verifyAdminAuth(req);
  if (authError) {
    console.log('[sync-points-table] Auth failed:', authError);
    if (authError === 'Admin access required') {
      return forbiddenResponse(authError, corsHeaders);
    }
    return unauthorizedResponse(authError, corsHeaders);
  }
  console.log(`[sync-points-table] Authenticated admin: ${user.id}`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { tournamentId, seriesId } = body;

    if (!tournamentId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tournament ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync-points-table] Syncing points table for tournament: ${tournamentId}, seriesId: ${seriesId}`);

    // Get the RapidAPI key from site_settings
    const { data: settings, error: settingsError } = await supabase
      .from('site_settings')
      .select('rapidapi_key, rapidapi_enabled')
      .limit(1)
      .maybeSingle();

    if (settingsError || !settings?.rapidapi_enabled || !settings?.rapidapi_key) {
      console.error('[sync-points-table] RapidAPI is disabled or not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'RapidAPI is disabled or not configured. Please configure RapidAPI key in Settings.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rapidApiKey = settings.rapidapi_key;

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

    // If no seriesId provided, we need to ask user for it
    if (!seriesId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Series ID is required. Please enter the Cricbuzz Series ID.',
          requiresSeriesId: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch points table from Cricbuzz RapidAPI
    const pointsTableUrl = `https://cricbuzz-cricket.p.rapidapi.com/stats/v1/series/${seriesId}/points-table`;
    
    console.log(`[sync-points-table] Fetching points table from: ${pointsTableUrl}`);
    
    const response = await fetchWithRetry(pointsTableUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'cricbuzz-cricket.p.rapidapi.com',
        'x-rapidapi-key': rapidApiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[sync-points-table] API error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ success: false, error: `API error: ${response.status}. Please check Series ID and API key.` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`[sync-points-table] API response:`, JSON.stringify(data).substring(0, 500));

    // Parse Cricbuzz response structure
    // The response has pointsTable array with groupTable entries
    const pointsTable = data.pointsTable || [];
    
    if (!pointsTable || pointsTable.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No points table data available for this series' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current points table entries to preserve NRR
    const { data: existingEntries } = await supabase
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
    let skippedTeams: string[] = [];

    // Process each group in points table
    for (const group of pointsTable) {
      const groupTable = group.pointsTableInfo || [];
      
      for (const standing of groupTable) {
        const apiTeamName = standing.teamName || '';
        
        if (!apiTeamName) continue;

        // Find matching team in our database
        const matchingTeam = teams.find(team => 
          teamsMatch(team.name, apiTeamName) || teamsMatch(team.short_name, apiTeamName)
        );

        if (!matchingTeam) {
          console.log(`[sync-points-table] No matching team found for: ${apiTeamName}`);
          skippedTeams.push(apiTeamName);
          continue;
        }

        console.log(`[sync-points-table] Matched ${apiTeamName} -> ${matchingTeam.name}`);

        // Parse Cricbuzz standing data
        const played = parseInt(standing.matchesPlayed || 0) || 0;
        const won = parseInt(standing.matchesWon || 0) || 0;
        const lost = parseInt(standing.matchesLost || 0) || 0;
        const tied = parseInt(standing.matchesTied || 0) || 0;
        const noResult = parseInt(standing.noRes || standing.noResult || 0) || 0;
        const points = parseInt(standing.points || 0) || 0;
        const position = parseInt(standing.position || 0) || 0;

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
    }

    console.log(`[sync-points-table] Sync complete. Updated: ${updatedCount}, Inserted: ${insertedCount}, Skipped: ${skippedTeams.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Points table synced successfully`,
        updated: updatedCount,
        inserted: insertedCount,
        skippedTeams: skippedTeams.length > 0 ? skippedTeams : undefined,
        seriesId,
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
