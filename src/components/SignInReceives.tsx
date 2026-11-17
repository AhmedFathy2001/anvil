/**
 * The one-line "what Anvil receives" reassurance (the full version is on /login). It sits beside
 * every button that starts Discord sign-in directly, so skipping /login never skips the disclosure.
 */
export default function SignInReceives({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[11.5px] leading-snug text-text-dim ${className}`}>
      Anvil receives your Discord username, avatar and email, never your password.{' '}
      {/* clan-prefix: platform -- the privacy page is the platform's */}
      <a href="/legal/privacy" className="text-gold hover:text-gold-light">Privacy</a>
    </p>
  );
}
