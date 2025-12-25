import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CricbuzzScore {
  matchId: string;
  title: string;
  status: string;
  matchStarted: boolean;
  matchEnded: boolean;
  score: Array<{
    r: number;
    w: number;
    o: number;
    inning: string;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { matchId } = await req.json();

    if (!matchId) {
      return new Response(
        JSON.stringify({ error: "Match ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching Cricbuzz score for match ID: ${matchId}`);

    // Try the mcrs (mini card) API endpoint - this is the most reliable
    const mcrsUrl = `https://www.cricbuzz.com/api/html/cricket-scorecard-mcrs/${matchId}`;
    
    const response = await fetch(mcrsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": `https://www.cricbuzz.com/live-cricket-scores/${matchId}`,
        "Origin": "https://www.cricbuzz.com",
        "Cache-Control": "no-cache",
      },
    });

    console.log(`MCRS Response status: ${response.status}`);

    if (!response.ok) {
      // Try alternative mobile endpoint
      const mobileUrl = `https://m.cricbuzz.com/api/html/cricket-scorecard/${matchId}`;
      console.log(`Trying mobile endpoint: ${mobileUrl}`);
      
      const mobileResponse = await fetch(mobileUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
          "Accept": "*/*",
        },
      });

      console.log(`Mobile response status: ${mobileResponse.status}`);
      
      if (!mobileResponse.ok) {
        throw new Error(`All Cricbuzz endpoints returned errors. Status: ${response.status}, ${mobileResponse.status}`);
      }
    }

    const text = await response.text();
    console.log(`Response length: ${text.length}`);
    console.log(`Response preview: ${text.substring(0, 500)}`);

    if (!text || text.length < 10) {
      throw new Error("Empty response from Cricbuzz API");
    }

    // Parse the HTML/JSON response to extract score data
    const scores: Array<{ r: number; w: number; o: number; inning: string }> = [];
    let status = "";
    let matchEnded = false;
    let title = `Match ${matchId}`;

    // Try parsing as JSON first
    try {
      if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
        const data = JSON.parse(text);
        console.log(`JSON keys: ${Object.keys(data).join(", ")}`);
        
        // Handle various JSON response formats
        if (data.score && Array.isArray(data.score)) {
          for (const sc of data.score) {
            scores.push({
              r: sc.r || sc.runs || 0,
              w: sc.w || sc.wickets || 0,
              o: parseFloat(sc.o || sc.overs || "0"),
              inning: sc.inning || sc.innings || `Inning ${scores.length + 1}`,
            });
          }
        }
        
        status = data.status || data.matchStatus || "";
        matchEnded = data.matchEnded || status.toLowerCase().includes("won") || status.toLowerCase().includes("draw");
        title = data.title || data.matchDesc || title;
      }
    } catch {
      console.log("Not valid JSON, parsing as HTML...");
    }

    // If JSON parsing didn't work, try HTML parsing
    if (scores.length === 0) {
      // Extract score patterns like "134/8 (20)" or "138/4 (19.1 ov)"
      const scoreRegex = /(\d+)[\s\/]+(\d+)\s*\((\d+\.?\d*)/g;
      let match;
      let idx = 0;
      
      while ((match = scoreRegex.exec(text)) !== null && idx < 4) {
        scores.push({
          r: parseInt(match[1]),
          w: parseInt(match[2]),
          o: parseFloat(match[3]),
          inning: `Inning ${idx + 1}`,
        });
        idx++;
      }

      // Try to find team names
      const teamRegex = /<[^>]*class="[^"]*team[^"]*"[^>]*>([^<]+)<\/[^>]*>/gi;
      const teamMatches = [...text.matchAll(teamRegex)];
      
      for (let i = 0; i < Math.min(teamMatches.length, scores.length); i++) {
        scores[i].inning = `${teamMatches[i][1].trim()} Inning ${Math.floor(i / 2) + 1}`;
      }

      // Check for match status
      if (text.toLowerCase().includes("won by") || text.toLowerCase().includes("match drawn")) {
        matchEnded = true;
      }
      
      // Extract status text if available
      const statusMatch = text.match(/<[^>]*class="[^"]*status[^"]*"[^>]*>([^<]+)<\/[^>]*>/i);
      if (statusMatch) {
        status = statusMatch[1].trim();
      }
    }

    if (scores.length === 0) {
      console.log("Could not extract any score data");
      return new Response(
        JSON.stringify({ 
          error: "Could not extract score data from Cricbuzz. The API may have changed or the match is not available.",
          hint: "Try using CricAPI as an alternative by enabling 'Live Score API' in match settings."
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const scoreData: CricbuzzScore = {
      matchId,
      title,
      status,
      matchStarted: true,
      matchEnded,
      score: scores,
    };

    console.log(`Successfully extracted score data: ${JSON.stringify(scoreData)}`);

    return new Response(
      JSON.stringify(scoreData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        hint: "Cricbuzz API may be temporarily unavailable. Try using CricAPI as an alternative."
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
