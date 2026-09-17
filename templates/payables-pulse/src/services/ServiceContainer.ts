import { IAuthService } from './interfaces/IAuthService';
import { OfflineAuthService } from './rayfin/OfflineAuthService';
import { RayfinAuthService } from './rayfin/RayfinAuthService';
import { OFFLINE_DEMO, RayfinClientService } from './rayfin/RayfinClientService';

/**
 * Builds the Rayfin client and the composite auth service.
 *
 * Username/password auth is only wired up when the API is running locally;
 * deployed Fabric apps use Fabric SSO exclusively.
 */
export class ServiceContainer {
  private static instance: ServiceContainer | null = null;

  public readonly authService: IAuthService;

  private constructor(authService: IAuthService) {
    this.authService = authService;
  }

  static create(): ServiceContainer {
    if (ServiceContainer.instance) return ServiceContainer.instance;

    if (OFFLINE_DEMO) {
      RayfinClientService.getInstance().initialize('offline://demo', 'pk-offline');
      ServiceContainer.instance = new ServiceContainer(new OfflineAuthService());
      return ServiceContainer.instance;
    }

    const apiUrl =
      import.meta.env.VITE_RAYFIN_API_URL || 'http://localhost:5168';
    const publishableKey = import.meta.env.VITE_RAYFIN_PUBLISHABLE_KEY;

    if (!publishableKey) {
      throw new Error(
        'VITE_RAYFIN_PUBLISHABLE_KEY environment variable is required'
      );
    }

    RayfinClientService.getInstance().initialize(
      apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`,
      publishableKey
    );

    const hostname = new URL(apiUrl).hostname;
    const isLocalEnvironment =
      hostname === 'localhost' || hostname === '127.0.0.1';

    const projectId = import.meta.env.VITE_FABRIC_ITEM_ID;
    const workspaceId = import.meta.env.VITE_FABRIC_WORKSPACE_ID;
    const fabricPortalUrl = import.meta.env.VITE_FABRIC_PORTAL_URL;
    const hasFabricConfig = !!(workspaceId && projectId && fabricPortalUrl);

    const authBuilder = RayfinAuthService.builder();
    if (isLocalEnvironment) authBuilder.withUsernameAuth();
    if (hasFabricConfig) {
      authBuilder.withFabricAuth({ workspaceId, projectId, fabricPortalUrl });
    }

    ServiceContainer.instance = new ServiceContainer(authBuilder.build());
    return ServiceContainer.instance;
  }

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      throw new Error('ServiceContainer not initialized. Call create() first.');
    }
    return ServiceContainer.instance;
  }

  static reset(): void {
    ServiceContainer.instance = null;
  }
}
