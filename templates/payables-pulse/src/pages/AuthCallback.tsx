import { bridgeFabricCallback } from '@microsoft/rayfin-auth-provider-fabric';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Older Fabric Portal builds redirect the auth popup here instead of using
 * postMessage. Bridge the handoff to the opener, then close; otherwise this is
 * just a redirect back to the dashboard.
 */
export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    if (bridgeFabricCallback()) return;
    navigate('/', { replace: true });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-sm text-muted-foreground">Signing you in…</div>
    </div>
  );
}
