import { FabricClient, type FabricClientConfig } from '@microsoft/fabric-app-data';
import { SemanticModelMessageClient } from '@microsoft/fabric-app-data-embed-client';
import { EmbedFabricApiProxy } from '@microsoft/fabric-app-data-proxy';

import { fabricConfig } from '@/fabric.generated';

let client: FabricClient | undefined;
let messageClient: SemanticModelMessageClient | undefined;

/**
 * Singleton {@link FabricClient} bound to the semantic models declared in
 * `fabric.yaml`.
 *
 * Queries are forwarded to the Fabric host over `postMessage`, so this path
 * only works while the app is embedded in the Fabric portal. {@link isEmbedded}
 * tells the data layer whether that transport is available.
 */
export function getFabricClient(): FabricClient {
  if (!messageClient) messageClient = new SemanticModelMessageClient();

  if (!client) {
    const proxy = new EmbedFabricApiProxy(messageClient);
    client = new FabricClient({
      proxy,
      ...fabricConfig,
    } as FabricClientConfig);
  }

  return client;
}

/**
 * True when the app is running inside an iframe, which is how Fabric hosts it.
 * Outside the portal the embed proxy has no host to talk to, so the data layer
 * falls back to the bundled development snapshot.
 */
export function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // A cross-origin parent throws on access, which still means we are framed.
    return true;
  }
}
