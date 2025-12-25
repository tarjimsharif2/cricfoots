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

    // Fetch match info from Cricbuzz unofficial API
    const matchInfoUrl = `https://www.cricbuzz.com/api/html/cricket-scorecard/${matchId}`;
    const scoreUrl = `https://www.cricbuzz.com/api/cricket-match/${matchId}/full-commentary/0`;
    
    // Try the mini score endpoint first (more reliable)
    const miniScoreUrl = `https://www.cricbuzz.com/api/cricket-match/${matchId}/mini-scorecard`;
    
    let scoreData: CricbuzzScore | null = null;

    try {
      // Try mini scorecard endpoint
      const response = await fetch(miniScoreUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data) {
          const scores: Array<{ r: number; w: number; o: number; inning: string }> = [];
          
          // Parse innings data from mini scorecard
          if (data.miniscore) {
            const mini = data.miniscore;
            
            // Current batting team
            if (mini.batTeam && mini.batTeam.teamScore) {
              scores.push({
                r: mini.batTeam.teamScore.inngs1?.runs || 0,
                w: mini.batTeam.teamScore.inngs1?.wickets || 0,
                o: parseFloat(mini.batTeam.teamScore.inngs1?.overs || "0"),
                inning: `${mini.batTeam.teamName || 'Team'} Inning 1`,
              });
            }
            
            // Bowling team (previous innings if available)
            if (mini.bowlTeam && mini.bowlTeam.teamScore) {
              scores.push({
                r: mini.bowlTeam.teamScore.inngs1?.runs || 0,
                w: mini.bowlTeam.teamScore.inngs1?.wickets || 0,
                o: parseFloat(mini.bowlTeam.teamScore.inngs1?.overs || "0"),
                inning: `${mini.bowlTeam.teamName || 'Team'} Inning 1`,
              });
            }
            
            scoreData = {
              matchId,
              title: mini.matchDesc || `Match ${matchId}`,
              status: mini.status || "",
              matchStarted: true,
              matchEnded: mini.matchState === "COMPLETE",
              score: scores,
            };
          }
        }
      }
    } catch (e) {
      console.error("Mini scorecard failed, trying alternative:", e);
    }

    // Try alternative endpoint if mini scorecard failed
    if (!scoreData) {
      try {
        const altUrl = `https://www.cricbuzz.com/api/cricket-match/${matchId}/commentary`;
        const response = await fetch(altUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data && data.matchHeader) {
            const scores: Array<{ r: number; w: number; o: number; inning: string }> = [];
            
            // Parse from matchHeader
            const header = data.matchHeader;
            
            if (header.team1 && header.team1.inngs1) {
              scores.push({
                r: header.team1.inngs1.runs || 0,
                w: header.team1.inngs1.wickets || 0,
                o: parseFloat(header.team1.inngs1.overs || "0"),
                inning: `${header.team1.name || 'Team 1'} Inning 1`,
              });
            }
            
            if (header.team2 && header.team2.inngs1) {
              scores.push({
                r: header.team2.inngs1.runs || 0,
                w: header.team2.inngs1.wickets || 0,
                o: parseFloat(header.team2.inngs1.overs || "0"),
                inning: `${header.team2.name || 'Team 2'} Inning 1`,
              });
            }

            scoreData = {
              matchId,
              title: header.matchDescription || `Match ${matchId}`,
              status: header.status || "",
              matchStarted: header.state !== "preview",
              matchEnded: header.state === "complete",
              score: scores,
            };
          }
        }
      } catch (e) {
        console.error("Alternative endpoint also failed:", e);
      }
    }

    if (!scoreData) {
      return new Response(
        JSON.stringify({ error: "Could not fetch score data from Cricbuzz" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(scoreData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
