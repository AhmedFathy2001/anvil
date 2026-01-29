import PlayersPoolClient from './PlayersPoolClient';

export const dynamic = 'force-dynamic';

export default async function AdminPlayersPage() {
  // Auth is handled by middleware
  return <PlayersPoolClient />;
}
