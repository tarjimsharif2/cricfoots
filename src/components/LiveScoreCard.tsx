import { useLiveCricketScore, CricketMatch } from '@/hooks/useLiveCricketScore';
import { useCricbuzzScore, CricbuzzScore } from '@/hooks/useCricbuzzScore';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface LiveScoreCardProps {
  teamAName: string;
  teamBName: string;
  apiScoreEnabled?: boolean;
  cricbuzzMatchId?: string | null;
}

interface ScoreItem {
  r: number;
  w: number;
  o: number;
  inning: string;
}

const ScoreDisplay = ({ scores }: { scores: ScoreItem[] }) => {
  if (!scores || scores.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Score not available yet</p>
    );
  }

  return (
    <div className="space-y-3">
      {scores.map((score, index) => (
        <div key={index} className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
          <span className="text-sm font-medium truncate flex-1">{score.inning}</span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-primary text-lg">
              {score.r}/{score.w}
            </span>
            <span className="text-muted-foreground text-sm">
              ({score.o} ov)
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

const LiveScoreCard = ({ teamAName, teamBName, apiScoreEnabled = false, cricbuzzMatchId }: LiveScoreCardProps) => {
  const { data: siteSettings } = useSiteSettings();
  
  // CricAPI hook
  const cricApiEnabled = !!siteSettings?.cricket_api_key && siteSettings?.cricket_api_enabled && apiScoreEnabled;
  const { 
    data: cricApiMatch, 
    isLoading: cricApiLoading, 
    isError: cricApiError, 
    refetch: refetchCricApi, 
    isFetching: cricApiFetching 
  } = useLiveCricketScore(teamAName, teamBName, cricApiEnabled);

  // Cricbuzz hook
  const { 
    data: cricbuzzData, 
    isLoading: cricbuzzLoading, 
    isError: cricbuzzError, 
    refetch: refetchCricbuzz, 
    isFetching: cricbuzzFetching 
  } = useCricbuzzScore(cricbuzzMatchId);

  // Determine which source to use (prefer Cricbuzz if available, then CricAPI)
  const useCricbuzz = !!cricbuzzMatchId && cricbuzzData;
  const useCricApi = cricApiEnabled && cricApiMatch;
  
  const isLoading = (cricbuzzMatchId ? cricbuzzLoading : false) || (cricApiEnabled ? cricApiLoading : false);
  const isFetching = cricApiFetching || cricbuzzFetching;
  const hasData = useCricbuzz || useCricApi;
  const isError = (cricbuzzMatchId && cricbuzzError && !useCricApi) || (cricApiEnabled && cricApiError && !useCricbuzz);

  // Don't render if neither source is configured
  if (!cricbuzzMatchId && !cricApiEnabled) {
    return null;
  }

  const handleRefresh = () => {
    if (cricbuzzMatchId) refetchCricbuzz();
    if (cricApiEnabled) refetchCricApi();
  };

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Fetching live score...</span>
        </CardContent>
      </Card>
    );
  }

  if (isError || !hasData) {
    return (
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardContent className="py-6 text-center">
          <p className="text-muted-foreground text-sm mb-3">
            Live score not available for this match
          </p>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Normalize the data for display
  let scores: ScoreItem[] = [];
  let status = '';
  let matchStarted = false;
  let matchEnded = false;
  let sourceName = '';

  if (useCricbuzz && cricbuzzData) {
    scores = cricbuzzData.score;
    status = cricbuzzData.status;
    matchStarted = cricbuzzData.matchStarted;
    matchEnded = cricbuzzData.matchEnded;
    sourceName = 'Cricbuzz';
  } else if (useCricApi && cricApiMatch) {
    scores = cricApiMatch.score || [];
    status = cricApiMatch.status;
    matchStarted = cricApiMatch.matchStarted;
    matchEnded = cricApiMatch.matchEnded;
    sourceName = 'CricAPI';
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      <Card className="border-border/50 bg-card/80 backdrop-blur overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Live Score</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {matchStarted && !matchEnded && (
                <Badge variant="live" className="animate-pulse">
                  <span className="w-2 h-2 bg-current rounded-full mr-1.5" />
                  LIVE
                </Badge>
              )}
              {matchEnded && (
                <Badge variant="completed">Completed</Badge>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleRefresh}
                disabled={isFetching}
                className="h-8 w-8"
              >
                <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScoreDisplay scores={scores} />
          
          {/* Match Status/Result */}
          {status && (
            <div className="pt-3 border-t border-border/30">
              <p className="text-sm font-medium text-center text-primary">
                {status}
              </p>
            </div>
          )}

          {/* Source indicator */}
          <p className="text-xs text-muted-foreground text-center">
            via {sourceName}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default LiveScoreCard;
