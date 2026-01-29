import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import PlayersPoolClient from './PlayersPoolClient';

export default async function AdminPlayersPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;

  if (token !== process.env.ADMIN_PASSWORD) {
    redirect('/admin');
  }

  return <PlayersPoolClient />;
}
