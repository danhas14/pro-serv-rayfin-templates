import { AuthError, type RayfinClient } from '@microsoft/rayfin-client';

import type { AppSchema } from '../../rayfin/data/schema';

import { type AuthUser, type IAuthService, toAuthUser } from './IAuthService';

// Local-dev fixture credentials, supplied per developer via env vars. They are
// deliberately NOT hardcoded: everything under VITE_* is inlined into the
// browser bundle at build time, so a literal here would ship a real (if inert)
// credential to anyone who loads the app.
//
// This module is also compiled out of production builds entirely — see the
// `import.meta.env.DEV` guard in bootstrap.ts. Both layers are intentional;
// removing either one puts credential material back in the package.
//
// Set these in your local `.env`:
//   VITE_LOCAL_DEV_EMAIL=dev@contoso.com
//   VITE_LOCAL_DEV_PASSWORD=<anything that satisfies the local backend>
const MOCK_EMAIL = import.meta.env.VITE_LOCAL_DEV_EMAIL as string | undefined;
const MOCK_PASSWORD = import.meta.env.VITE_LOCAL_DEV_PASSWORD as
  | string
  | undefined;

function requireLocalCredentials(): { email: string; password: string } {
  if (!MOCK_EMAIL || !MOCK_PASSWORD) {
    throw new Error(
      'Local-dev sign-in needs VITE_LOCAL_DEV_EMAIL and ' +
        'VITE_LOCAL_DEV_PASSWORD in your .env file.'
    );
  }
  return { email: MOCK_EMAIL, password: MOCK_PASSWORD };
}

/**
 * Local-development auth service. Used when the API URL targets localhost.
 *
 * Signs into the bundled local backend with an email/password from your local
 * `.env` — no Fabric/Entra wiring required. If the dev account does not exist
 * yet on the local backend, it is created on first sign-in.
 */
export class MockAuthService implements IAuthService {
  readonly fabricAuthEnabled = false;

  constructor(private readonly client: RayfinClient<AppSchema>) {}

  async signIn(): Promise<AuthUser> {
    const auth = this.client.auth;
    const credentials = requireLocalCredentials();

    // Try sign-in. If the credentials are rejected (also how the backend
    // reports "user does not exist") create the account and retry. Other
    // errors (network, server, …) propagate unchanged.
    try {
      await auth.signIn(credentials);
    } catch (err) {
      if (!(err instanceof AuthError) || err.code !== 'INVALID_GRANT') {
        throw err;
      }
      await auth.signUp(credentials);
      await auth.signIn(credentials);
    }

    const session = auth.getSession();
    if (!session.isAuthenticated || !session.user) {
      throw new Error('Local mock sign-in failed to establish a session.');
    }
    return toAuthUser(session.user);
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const session = this.client.auth.getSession();
    if (!session.isAuthenticated || !session.user) return null;
    return toAuthUser(session.user);
  }

  async initEmbeddedAuth(): Promise<AuthUser | null> {
    // Embedded Fabric flow is not used in local-dev mode.
    return null;
  }
}
