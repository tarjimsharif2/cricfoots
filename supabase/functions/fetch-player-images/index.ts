import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize player name for matching
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Fuzzy match: check if search name parts are contained in result name
function fuzzyMatch(searchName: string, resultName: string): boolean {
  const searchParts = normalizeName(searchName).split(' ');
  const resultNorm = normalizeName(resultName);
  
  // Last name must match
  const lastName = searchParts[searchParts.length - 1];
  if (!resultNorm.includes(lastName)) return false;
  
  // At least first name initial or full first name should match
  if (searchParts.length > 1) {
    const firstName = searchParts[0];
    if (resultNorm.includes(firstName) || resultNorm.startsWith(firstName[0])) {
      return true;
    }
  }
  
  return searchParts.length === 1; // Single name match
}

// Fetch with timeout
async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
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

    if (!matchId) {
      return new Response(JSON.stringify({ success: false, error: 'matchId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get players without images for this match
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

    console.log(`[FetchImages] Found ${players.length} players without images`);

    let updatedCount = 0;
    const errors: string[] = [];

    // Process players in batches to avoid rate limiting
    for (const player of players) {
      try {
        const encodedName = encodeURIComponent(player.player_name);
        
        // Try TheSportsDB first
        const searchUrl = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodedName}`;
        const res = await fetchWithTimeout(searchUrl);
        
        if (res.ok) {
          const data = await res.json();
          
          if (data.player && data.player.length > 0) {
            // Find best matching player
            let bestMatch = null;
            
            for (const p of data.player) {
              if (fuzzyMatch(player.player_name, p.strPlayer)) {
                // Prefer cutout image, then thumb, then fanart
                const imageUrl = p.strCutout || p.strThumb || p.strRender || null;
                if (imageUrl) {
                  bestMatch = imageUrl;
                  break;
                }
              }
            }
            
            // If no fuzzy match, try the first result if name is close enough
            if (!bestMatch && data.player[0]) {
              const firstResult = data.player[0];
              const imageUrl = firstResult.strCutout || firstResult.strThumb || firstResult.strRender || null;
              if (imageUrl && normalizeName(firstResult.strPlayer).includes(normalizeName(player.player_name).split(' ').pop()!)) {
                bestMatch = imageUrl;
              }
            }
            
            if (bestMatch) {
              const { error: updateError } = await supabase
                .from('match_playing_xi')
                .update({ player_image: bestMatch })
                .eq('id', player.id);
              
              if (!updateError) {
                updatedCount++;
                console.log(`[FetchImages] ✓ ${player.player_name} → ${bestMatch.substring(0, 60)}...`);
              }
            } else {
              console.log(`[FetchImages] ✗ ${player.player_name} - no image in results`);
            }
          } else {
            console.log(`[FetchImages] ✗ ${player.player_name} - no results found`);
          }
        }
        
        // Small delay between requests to be respectful
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
