import {
  AuthUser,
  IAuthService,
  SignUpResult,
} from '../interfaces/IAuthService';

const OFFLINE_USER: AuthUser = {
  id: 'offline-subject-0001',
  email: 'demo.operator@payablespulse.demo',
  name: 'Demo Operator',
};

/** Dev-only auth stub paired with {@link createOfflineClient}. */
export class OfflineAuthService implements IAuthService {
  readonly usernameAuthEnabled = false;
  readonly fabricAuthEnabled = false;

  async signUp(): Promise<SignUpResult> {
    return { emailVerified: true };
  }

  async signIn(): Promise<AuthUser> {
    return OFFLINE_USER;
  }

  async signOut(): Promise<void> {}

  async getCurrentUser(): Promise<AuthUser | null> {
    return OFFLINE_USER;
  }

  async isAuthenticated(): Promise<boolean> {
    return true;
  }

  async initEmbeddedAuth(): Promise<AuthUser | null> {
    return OFFLINE_USER;
  }

  async initiateFabricLogin(): Promise<void> {}

  async ensureSignedInWithFabric(): Promise<AuthUser> {
    return OFFLINE_USER;
  }
}
