import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/['']/g, '').replace(/\s+/g, ' ').trim();
}

async function fetchWithTimeout(url: string, timeoutMs = 8000, headers?: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...headers
      }
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// Check if description is sports-related
function isSportsPerson(description: string | undefined): boolean {
  if (!description) return false;
  const d = description.toLowerCase();
  return /cricket|football|soccer|cricketer|footballer|player|athlete|sport|batsman|bowler|batters|pitcher|keeper/i.test(d);
}

// Source 1: Wikipedia REST API (direct page)
async function tryWikipediaDirect(playerName: string): Promise<string | null> {
  try {
    const wikiName = playerName.replace(/\s+/g, '_');
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiName)}`;
    const res = await fetchWithTimeout(url, 6000);
    
    if (res.ok) {
      const data = await res.json();
      const thumb = data.originalimage?.source || data.thumbnail?.source;
      if (thumb && isSportsPerson(data.description)) {
        console.log(`[FetchImages] ✓ Wiki Direct: ${playerName}`);
        return thumb;
      }
    }
  } catch (e) {
    console.warn(`[FetchImages] Wiki direct failed for ${playerName}:`, e.message);
  }
  return null;
}

// Source 2: Wikipedia Search API (fuzzy search)
async function tryWikipediaSearch(playerName: string, sport: string): Promise<string | null> {
  try {
    const sportTerm = sport === 'football' ? 'footballer' : 'cricketer';
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(playerName)}+${sportTerm}&format=json&srlimit=5`;
    const searchRes = await fetchWithTimeout(searchUrl, 6000);
    
    if (!searchRes.ok) return null;
    
    const searchData = await searchRes.json();
    const results = searchData?.query?.search || [];
    
    for (const result of results) {
      const title = result.title.replace(/\s+/g, '_');
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const summaryRes = await fetchWithTimeout(summaryUrl, 5000);
      
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        const thumb = data.originalimage?.source || data.thumbnail?.source;
        if (thumb && isSportsPerson(data.description)) {
          // Verify name similarity - at least last name should match
          const lastNameSearch = normalizeName(playerName).split(' ').pop()!;
          const resultTitle = normalizeName(result.title);
          if (resultTitle.includes(lastNameSearch)) {
            console.log(`[FetchImages] ✓ Wiki Search: ${playerName} → ${result.title}`);
            return thumb;
          }
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }
  } catch (e) {
    console.warn(`[FetchImages] Wiki search failed for ${playerName}:`, e.message);
  }
  return null;
}

// Source 3: Google Knowledge Graph-like search via Wikidata
async function tryWikidata(playerName: string, sport: string): Promise<string | null> {
  try {
    const sportTerm = sport === 'football' ? 'footballer' : 'cricketer';
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(playerName + ' ' + sportTerm)}&language=en&format=json&limit=3`;
    const res = await fetchWithTimeout(searchUrl, 6000);
    
    if (!res.ok) return null;
    
    const data = await res.json();
    const results = data?.search || [];
    
    for (const entity of results) {
      if (entity.description && isSportsPerson(entity.description)) {
        // Get Wikipedia page from Wikidata
        const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entity.id}&props=sitelinks&sitefilter=enwiki&format=json`;
        const entityRes = await fetchWithTimeout(entityUrl, 5000);
        
        if (entityRes.ok) {
          const entityData = await entityRes.json();
          const enwikiTitle = entityData?.entities?.[entity.id]?.sitelinks?.enwiki?.title;
          
          if (enwikiTitle) {
            const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(enwikiTitle.replace(/\s+/g, '_'))}`;
            const summaryRes = await fetchWithTimeout(summaryUrl, 5000);
            
            if (summaryRes.ok) {
              const summaryData = await summaryRes.json();
              const thumb = summaryData.originalimage?.source || summaryData.thumbnail?.source;
              if (thumb) {
                console.log(`[FetchImages] ✓ Wikidata: ${playerName} → ${enwikiTitle}`);
                return thumb;
              }
            }
          }
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }
  } catch (e) {
    console.warn(`[FetchImages] Wikidata failed for ${playerName}:`, e.message);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { matchId, sport } = await req.json();
    const sportType = sport || 'cricket';

    if (!matchId) {
      return new Response(JSON.stringify({ success: false, error: 'matchId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: players, error: playersError } = await supabase
      .from('match_playing_xi')
      .select('id, player_name, team_id, player_image')
      .eq('match_id', matchId)
      .or('player_image.is.null,player_image.eq.');

    if (playersError) throw playersError;

    if (!players || players.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'All players already have images',
        updated: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[FetchImages] Found ${players.length} players without images (sport: ${sportType})`);

    let updatedCount = 0;
    const errors: string[] = [];

    for (const player of players) {
      try {
        let imageUrl: string | null = null;

        // Try Wikipedia direct first
        imageUrl = await tryWikipediaDirect(player.player_name);

        // Try Wikipedia search
        if (!imageUrl) {
          imageUrl = await tryWikipediaSearch(player.player_name, sportType);
        }

        // Try Wikidata as last resort
        if (!imageUrl) {
          imageUrl = await tryWikidata(player.player_name, sportType);
        }

        if (imageUrl) {
          const { error: updateError } = await supabase
            .from('match_playing_xi')
            .update({ player_image: imageUrl })
            .eq('id', player.id);
          if (!updateError) {
            updatedCount++;
          }
        } else {
          console.log(`[FetchImages] ✗ ${player.player_name} - no image found`);
        }

        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        console.warn(`[FetchImages] Error for ${player.player_name}:`, err.message);
        errors.push(`${player.player_name}: ${err.message}`);
      }
    }

    console.log(`[FetchImages] Done: ${updatedCount}/${players.length} images found`);

    return new Response(JSON.stringify({
      success: true,
      total: players.length,
      updated: updatedCount,
      notFound: players.length - updatedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `${updatedCount} out of ${players.length} missing images found`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[FetchImages] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
