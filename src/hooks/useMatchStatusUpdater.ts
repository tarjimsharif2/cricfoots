import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Match } from '@/hooks/useSportsData';

export const useMatchStatusUpdater = (matches: Match[] | undefined) => {
  const updateMatchStatus = useCallback(async (matchId: string, newStatus: 'live' | 'completed' | 'abandoned' | 'postponed') => {
    try {
      const { error } = await supabase
        .from('matches')
        .update({ status: newStatus })
        .eq('id', matchId);
      
      if (error) {
        console.error('Error updating match status:', error);
      }
    } catch (err) {
      console.error('Failed to update match status:', err);
    }
  }, []);

  useEffect(() => {
    if (!matches || matches.length === 0) return;

    const checkAndUpdateStatuses = () => {
      const now = new Date();

      matches.forEach((match) => {
        if (!match.match_start_time) return;

        const startTime = new Date(match.match_start_time);
        
        // Use match_end_time if explicitly set, otherwise calculate from duration
        let endTime: Date;
        if (match.match_end_time) {
          endTime = new Date(match.match_end_time);
        } else {
          const durationMs = (match.match_duration_minutes || 180) * 60 * 1000;
          endTime = new Date(startTime.getTime() + durationMs);
        }

        // If match should be live (started but not ended)
        if (match.status === 'upcoming' && now >= startTime && now < endTime) {
          updateMatchStatus(match.id, 'live');
        }
        
        // If match should be completed (past end time) - only auto-complete if NOT live
        // Live matches should only be completed manually or via API sync
        if (match.status === 'upcoming' && now >= endTime) {
          updateMatchStatus(match.id, 'completed');
        }
      });
    };

    // Check immediately
    checkAndUpdateStatuses();

    // Check every 30 seconds
    const interval = setInterval(checkAndUpdateStatuses, 30000);

    return () => clearInterval(interval);
  }, [matches, updateMatchStatus]);
};
