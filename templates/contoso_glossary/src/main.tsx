import { createRoot } from 'react-dom/client';
import { bridgeFabricCallback } from '@microsoft/rayfin-auth-provider-fabric';

import App from '@/App';
import { AuthProvider } from '@/hooks/AuthContext';
import { bootstrapAuth } from '@/services/bootstrap';

import './main.css';

// Legacy Fabric broker flows redirect the popup to /auth/callback.
// Forward that handoff before the app initializes its auth provider.
bridgeFabricCallback();

const authService = bootstrapAuth();

createRoot(document.getElementById('root')!).render(
  <AuthProvider authService={authService}>
    <App />
  </AuthProvider>
);
