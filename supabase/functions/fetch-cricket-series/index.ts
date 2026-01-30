import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CricbuzzSeries {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  matchCount?: number;
}

interface SeriesInfo {
  seriesId: string;
  seriesName: string;
  startDate: string | null;
  endDate: string | null;
  matchCount: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[fetch-cricket-series] Starting series fetch...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get RapidAPI settings
    const { data: settings } = await supabase
      .from('site_settings')
      .select('rapidapi_key, rapidapi_endpoints, rapidapi_enabled')
      .single();

    if (!settings?.rapidapi_enabled || !settings?.rapidapi_key) {
      return new Response(
        JSON.stringify({ success: false, error: 'RapidAPI is not enabled or configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const endpoints = settings.rapidapi_endpoints as Record<string, string> || {};
    const cricbuzzHost = endpoints.cricbuzz_host || 'cricbuzz-cricket.p.rapidapi.com';
    
    const allSeries: SeriesInfo[] = [];
    
    // Fetch from multiple endpoints to get comprehensive series list
    const fetchEndpoints = [
      '/series/v1/international',
      '/series/v1/league',
      '/series/v1/domestic',
    ];

    for (const endpoint of fetchEndpoints) {
      try {
        console.log(`[fetch-cricket-series] Fetching from: ${endpoint}`);
        
        const response = await fetch(`https://${cricbuzzHost}${endpoint}`, {
          headers: {
            'X-RapidAPI-Key': settings.rapidapi_key,
            'X-RapidAPI-Host': cricbuzzHost,
          },
        });

        if (!response.ok) {
          console.error(`[fetch-cricket-series] Error fetching ${endpoint}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        
        // Parse series from response - Cricbuzz returns nested structure
        if (data.seriesMapProto) {
          for (const category of data.seriesMapProto) {
            if (category.series && Array.isArray(category.series)) {
              for (const series of category.series) {
                if (series.seriesId && series.seriesName) {
                  // Skip if already added
                  if (allSeries.some(s => s.seriesId === String(series.seriesId))) {
                    continue;
                  }
                  
                  allSeries.push({
                    seriesId: String(series.seriesId),
                    seriesName: series.seriesName,
                    startDate: series.startDt ? new Date(parseInt(series.startDt)).toISOString().split('T')[0] : null,
                    endDate: series.endDt ? new Date(parseInt(series.endDt)).toISOString().split('T')[0] : null,
                    matchCount: series.matches || 0,
                  });
                  
                  console.log(`[fetch-cricket-series] Found: ${series.seriesName} (ID: ${series.seriesId})`);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`[fetch-cricket-series] Error processing ${endpoint}:`, error);
      }
    }

    console.log(`[fetch-cricket-series] Total series found: ${allSeries.length}`);

    // Upsert series to tournaments table
    let insertedCount = 0;
    let updatedCount = 0;

    for (const series of allSeries) {
      // Check if tournament with this series_id already exists
      const { data: existing } = await supabase
        .from('tournaments')
        .select('id, name')
        .eq('series_id', series.seriesId)
        .maybeSingle();

      if (existing) {
        // Update existing tournament's dates if changed
        const { error } = await supabase
          .from('tournaments')
          .update({
            start_date: series.startDate,
            end_date: series.endDate,
            total_matches: series.matchCount || null,
            updated_at: new Date().toISOString(),
          })
          .eq('series_id', series.seriesId);

        if (!error) updatedCount++;
      } else {
        // Generate slug from series name
        const slug = series.seriesName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        // Determine season from dates or current year
        const season = series.startDate 
          ? new Date(series.startDate).getFullYear().toString()
          : new Date().getFullYear().toString();

        // Insert new tournament
        const { error } = await supabase
          .from('tournaments')
          .insert({
            name: series.seriesName,
            series_id: series.seriesId,
            sport: 'Cricket',
            season: season,
            slug: slug,
            start_date: series.startDate,
            end_date: series.endDate,
            total_matches: series.matchCount || null,
            is_active: true,
            show_in_menu: false,
            show_in_homepage: false,
            seo_title: `${series.seriesName} - Live Scores & Updates`,
            seo_description: `Watch ${series.seriesName} live scores, schedules, and streaming links.`,
          });

        if (!error) {
          insertedCount++;
          console.log(`[fetch-cricket-series] Inserted: ${series.seriesName}`);
        } else {
          console.error(`[fetch-cricket-series] Insert error for ${series.seriesName}:`, error);
        }
      }
    }

    console.log(`[fetch-cricket-series] Inserted: ${insertedCount}, Updated: ${updatedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        total: allSeries.length,
        inserted: insertedCount,
        updated: updatedCount,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[fetch-cricket-series] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
