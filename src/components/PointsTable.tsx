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
        <CardHeader className="pb-2 px-3 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <span className="truncate">{tournamentName ? `${tournamentName} - Points Table` : 'Points Table'}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile Card View */}
          <div className="block sm:hidden divide-y divide-border/30">
            {entries.map((entry, index) => (
              <div 
                key={entry.id} 
                className={`p-3 ${index < 4 ? 'bg-primary/5' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {entry.position || index + 1}
                    </span>
                    {entry.team?.logo_url && (
                      <img 
                        src={entry.team.logo_url} 
                        alt={entry.team.name} 
                        className="w-5 h-5 object-contain"
                      />
                    )}
                    <span className="font-medium text-sm">{entry.team?.short_name || entry.team?.name}</span>
                  </div>
                  <span className="font-bold text-primary text-lg">{entry.points} pts</span>
                </div>
                <div className="grid grid-cols-5 gap-1 text-xs text-muted-foreground">
                  <div className="text-center">
                    <div className="font-medium text-foreground">{entry.played}</div>
                    <div>P</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-green-500">{entry.won}</div>
                    <div>W</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-red-500">{entry.lost}</div>
                    <div>L</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-foreground">{entry.tied}/{entry.no_result}</div>
                    <div>T/NR</div>
                  </div>
                  <div className="text-center">
                    <div className={`font-medium ${entry.net_run_rate >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {entry.net_run_rate >= 0 ? '+' : ''}{entry.net_run_rate.toFixed(2)}
                    </div>
                    <div>NRR</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Desktop Table View */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-10 text-center px-2">#</TableHead>
                  <TableHead className="px-2">Team</TableHead>
                  <TableHead className="text-center w-10 px-1">P</TableHead>
                  <TableHead className="text-center w-10 px-1">W</TableHead>
                  <TableHead className="text-center w-10 px-1">L</TableHead>
                  {!compact && (
                    <>
                      <TableHead className="text-center w-10 px-1">T</TableHead>
                      <TableHead className="text-center w-10 px-1">NR</TableHead>
                    </>
                  )}
                  <TableHead className="text-center w-14 px-1">NRR</TableHead>
                  <TableHead className="text-center w-10 px-2 font-bold">Pts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, index) => (
                  <TableRow 
                    key={entry.id} 
                    className={index < 4 ? 'bg-primary/5' : ''}
                  >
                    <TableCell className="text-center font-medium px-2 py-2">
                      {entry.position || index + 1}
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      <div className="flex items-center gap-1.5">
                        {entry.team?.logo_url && (
                          <img 
                            src={entry.team.logo_url} 
                            alt={entry.team.name} 
                            className="w-5 h-5 object-contain flex-shrink-0"
                          />
                        )}
                        <span className="font-medium text-sm truncate">
                          {compact ? entry.team?.short_name : entry.team?.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center px-1 py-2">{entry.played}</TableCell>
                    <TableCell className="text-center text-green-500 font-medium px-1 py-2">{entry.won}</TableCell>
                    <TableCell className="text-center text-red-500 px-1 py-2">{entry.lost}</TableCell>
                    {!compact && (
                      <>
                        <TableCell className="text-center px-1 py-2">{entry.tied}</TableCell>
                        <TableCell className="text-center px-1 py-2">{entry.no_result}</TableCell>
                      </>
                    )}
                    <TableCell className={`text-center px-1 py-2 ${entry.net_run_rate >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {entry.net_run_rate >= 0 ? '+' : ''}{entry.net_run_rate.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center font-bold text-primary px-2 py-2">{entry.points}</TableCell>
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
