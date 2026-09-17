import { useState } from 'react';
import { Link } from 'react-router-dom';

import contosoLogo from '@/assets/contoso-logo.svg';
import { useAuth } from '@/hooks/AuthContext';

const msLogo = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 21 21"
    className="mr-2"
  >
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
);

export function AuthPage() {
  const { signIn, fabricAuthEnabled } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setError(null);
    setIsLoading(true);

    try {
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  const buttonLabel = isLoading
    ? fabricAuthEnabled
      ? 'Opening Fabric...'
      : 'Signing in...'
    : 'Sign in with Microsoft';

  return (
    <div className="glossary-auth-page">
      <div className="auth-card">
        <img className="auth-logo" src={contosoLogo} alt="Contoso" />
        <p className="auth-label">Contoso Glossary</p>
        <h1>Welcome back</h1>
        <p>Sign in to manage business terms, categories, and glossary governance.</p>

        <button
          type="button"
          onClick={handleSignIn}
          disabled={isLoading}
          className="fluent-btn auth-btn"
        >
          {msLogo}
          {buttonLabel}
        </button>

        {error && <p className="error-box">{error}</p>}

        <Link className="auth-link" to="/">
          Continue as viewer
        </Link>
      </div>
    </div>
  );
}
