export type MatchStatus = 'upcoming' | 'live' | 'completed';

export interface Team {
  id: string;
  name: string;
  short_name: string;
  logo_url: string;
}

export interface Tournament {
  id: string;
  name: string;
  sport: string;
  season: string;
}

export interface Match {
  id: string;
  tournament: Tournament;
  team_a: Team;
  team_b: Team;
  match_number: number;
  match_date: string;
  match_time: string;
  status: MatchStatus;
  venue?: string;
  score_a?: string;
  score_b?: string;
}

// Sample data for initial development
export const sampleTeams: Team[] = [
  { id: '1', name: 'Sylhet Titans', short_name: 'SYL', logo_url: '' },
  { id: '2', name: 'Rajshahi Warriors', short_name: 'RAJ', logo_url: '' },
  { id: '3', name: 'Noakhali Express', short_name: 'NOA', logo_url: '' },
  { id: '4', name: 'Chattogram Royals', short_name: 'CTG', logo_url: '' },
  { id: '5', name: 'Dhaka Capitals', short_name: 'DHA', logo_url: '' },
  { id: '6', name: 'Rangpur Riders', short_name: 'RAN', logo_url: '' },
];

export const sampleTournament: Tournament = {
  id: '1',
  name: 'BPL',
  sport: 'Cricket',
  season: '2025-26',
};

export const sampleMatches: Match[] = [
  {
    id: '1',
    tournament: sampleTournament,
    team_a: sampleTeams[0],
    team_b: sampleTeams[1],
    match_number: 1,
    match_date: '26th December 2025 (Friday)',
    match_time: '3:00 PM (BST)',
    status: 'upcoming',
  },
  {
    id: '2',
    tournament: sampleTournament,
    team_a: sampleTeams[2],
    team_b: sampleTeams[3],
    match_number: 2,
    match_date: '26th December 2025 (Friday)',
    match_time: '7:45 PM (BST)',
    status: 'upcoming',
  },
  {
    id: '3',
    tournament: sampleTournament,
    team_a: sampleTeams[4],
    team_b: sampleTeams[1],
    match_number: 3,
    match_date: '27th December 2025 (Saturday)',
    match_time: '1:00 PM (BST)',
    status: 'upcoming',
  },
  {
    id: '4',
    tournament: sampleTournament,
    team_a: sampleTeams[2],
    team_b: sampleTeams[0],
    match_number: 4,
    match_date: '27th December 2025 (Saturday)',
    match_time: '6:00 PM (BST)',
    status: 'upcoming',
  },
  {
    id: '5',
    tournament: sampleTournament,
    team_a: sampleTeams[5],
    team_b: sampleTeams[3],
    match_number: 5,
    match_date: '29th December 2025 (Monday)',
    match_time: '1:00 PM (BST)',
    status: 'upcoming',
  },
  {
    id: '6',
    tournament: sampleTournament,
    team_a: sampleTeams[2],
    team_b: sampleTeams[1],
    match_number: 6,
    match_date: '29th December 2025 (Monday)',
    match_time: '6:00 PM (BST)',
    status: 'upcoming',
  },
];
