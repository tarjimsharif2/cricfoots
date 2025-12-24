import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { Team } from '@/hooks/useSportsData';

export interface PointsTableEntry {
  id: string;
  tournament_id: string;
  team_id: string;
  position: number;
  played: number;
  won: number;
  lost: number;
  tied: number;
  no_result: number;
  net_run_rate: number;
  points: number;
  team?: Team;
}

export const usePointsTable = (tournamentId: string | undefined) => {
  return useQuery({
    queryKey: ['points_table', tournamentId],
    queryFn: async () => {
      if (!tournamentId) return [];
      
      const { data, error } = await supabase
        .from('tournament_points_table')
        .select(`
          *,
          team:teams(*)
        `)
        .eq('tournament_id', tournamentId)
        .order('position', { ascending: true });
      
      if (error) throw error;
      return data as PointsTableEntry[];
    },
    enabled: !!tournamentId,
  });
};

interface PointsTableProps {
  tournamentId: string;
  tournamentName?: string;
  compact?: boolean;
}

const PointsTable = ({ tournamentId, tournamentName, compact = false }: PointsTableProps) => {
  const { data: entries, isLoading } = usePointsTable(tournamentId);

  if (isLoading) {
    return null;
  }

  if (!entries || entries.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <Card className="overflow-hidden border-border/50 bg-card/80 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="w-5 h-5 text-primary" />
            {tournamentName ? `${tournamentName} - Points Table` : 'Points Table'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-center w-12">P</TableHead>
                  <TableHead className="text-center w-12">W</TableHead>
                  <TableHead className="text-center w-12">L</TableHead>
                  {!compact && (
                    <>
                      <TableHead className="text-center w-12">T</TableHead>
                      <TableHead className="text-center w-12">NR</TableHead>
                    </>
                  )}
                  <TableHead className="text-center w-16">NRR</TableHead>
                  <TableHead className="text-center w-12 font-bold">Pts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, index) => (
                  <TableRow 
                    key={entry.id} 
                    className={index < 4 ? 'bg-primary/5' : ''}
                  >
                    <TableCell className="text-center font-medium">
                      {entry.position || index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {entry.team?.logo_url && (
                          <img 
                            src={entry.team.logo_url} 
                            alt={entry.team.name} 
                            className="w-6 h-6 object-contain"
                          />
                        )}
                        <span className="font-medium text-sm">
                          {compact ? entry.team?.short_name : entry.team?.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{entry.played}</TableCell>
                    <TableCell className="text-center text-green-500 font-medium">{entry.won}</TableCell>
                    <TableCell className="text-center text-red-500">{entry.lost}</TableCell>
                    {!compact && (
                      <>
                        <TableCell className="text-center">{entry.tied}</TableCell>
                        <TableCell className="text-center">{entry.no_result}</TableCell>
                      </>
                    )}
                    <TableCell className={`text-center ${entry.net_run_rate >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {entry.net_run_rate >= 0 ? '+' : ''}{entry.net_run_rate.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-center font-bold text-primary">{entry.points}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default PointsTable;
