import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg mt-16 p-4 text-center">
      <p className="text-6xl mb-2">🗺️</p>
      <h1 className="text-2xl font-bold text-gold mb-2">Not found</h1>
      <p className="text-sm text-text-muted mb-6">
        The page you're looking for doesn't exist, or the event has been removed.
      </p>
      <Link
        href="/"
        className="inline-block px-4 py-2 text-sm font-semibold bg-gold hover:bg-yellow-500 text-brown-dark rounded-lg transition-colors"
      >
        Back home
      </Link>
    </div>
  );
}
