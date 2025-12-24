import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import { motion } from 'framer-motion';

interface Player {
  id: string;
  match_id: string;
  team_id: string;
  player_name: string;
  player_role: string | null;
  is_captain: boolean;
  is_vice_captain: boolean;
  is_wicket_keeper: boolean;
  batting_order: number | null;
}

interface PlayingXIProps {
  matchId: string;
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
  teamALogo?: string | null;
  teamBLogo?: string | null;
}

export const usePlayingXI = (matchId: string | undefined) => {
  return useQuery({
    queryKey: ['playing_xi', matchId],
    queryFn: async () => {
      if (!matchId) return [];
      
      const { data, error } = await supabase
        .from('match_playing_xi')
        .select('*')
        .eq('match_id', matchId)
        .order('batting_order', { ascending: true, nullsFirst: false });
      
      if (error) throw error;
      return data as Player[];
    },
    enabled: !!matchId,
  });
};

const PlayingXI = ({ matchId, teamAId, teamBId, teamAName, teamBName, teamALogo, teamBLogo }: PlayingXIProps) => {
  const { data: players, isLoading } = usePlayingXI(matchId);

  if (isLoading) {
    return null;
  }

  const teamAPlayers = players?.filter(p => p.team_id === teamAId) || [];
  const teamBPlayers = players?.filter(p => p.team_id === teamBId) || [];

  // Don't render if no players
  if (teamAPlayers.length === 0 && teamBPlayers.length === 0) {
    return null;
  }

  const renderPlayer = (player: Player) => (
    <div key={player.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{player.player_name}</span>
        {player.is_captain && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">C</Badge>
        )}
        {player.is_vice_captain && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">VC</Badge>
        )}
        {player.is_wicket_keeper && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">WK</Badge>
        )}
      </div>
      {player.player_role && (
        <span className="text-xs text-muted-foreground">{player.player_role}</span>
      )}
    </div>
  );

  const renderTeamSection = (teamName: string, teamLogo: string | null | undefined, players: Player[]) => (
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/30">
        {teamLogo && (
          <img src={teamLogo} alt={teamName} className="w-6 h-6 object-contain" />
        )}
        <h4 className="font-semibold text-sm">{teamName}</h4>
        <Badge variant="secondary" className="text-[10px]">{players.length} Players</Badge>
      </div>
      <div className="space-y-1.5">
        {players.map(renderPlayer)}
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card className="overflow-hidden border-border/50 bg-card/80 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5 text-primary" />
            Playing XI
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {teamAPlayers.length > 0 && renderTeamSection(teamAName, teamALogo, teamAPlayers)}
            {teamBPlayers.length > 0 && renderTeamSection(teamBName, teamBLogo, teamBPlayers)}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default PlayingXI;
