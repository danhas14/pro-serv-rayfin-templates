import { InfoIcon } from 'lucide-react';
import { useState } from 'react';

import { SignInForm } from '@/components/SignInForm';
import { SignUpForm } from '@/components/SignUpForm';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/AuthContext';

type AuthView = 'login' | 'signup';

export function AuthPage() {
  const [view, setView] = useState<AuthView>('login');
  const {
    signInWithFabric,
    signIn,
    signUp,
    usernameAuthEnabled,
    fabricAuthEnabled,
  } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center gap-3 pb-2">
          <img
            src="/payables-pulse.svg"
            alt=""
            aria-hidden="true"
            className="h-11 w-11 rounded-lg"
          />
          <div className="leading-tight text-sidebar-foreground">
            <div className="text-lg font-semibold">Payables Pulse</div>
            <div className="text-sm text-sidebar-foreground/70">
              Payment Operations Control Center
            </div>
          </div>
        </div>

        {fabricAuthEnabled && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sign in</CardTitle>
              <CardDescription>
                Use your Microsoft Fabric account to open the control center.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SignInForm onFabricSignIn={signInWithFabric} />
            </CardContent>
          </Card>
        )}

        {usernameAuthEnabled && (
          <>
            {fabricAuthEnabled && (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-600">
                <InfoIcon className="h-4 w-4" />
                <AlertDescription className="text-amber-800">
                  Email and password sign-in is available in local development
                  only. Deployed Fabric apps use Fabric SSO.
                </AlertDescription>
              </Alert>
            )}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {fabricAuthEnabled ? 'Local sign in' : 'Sign in'}
                </CardTitle>
                <CardDescription>
                  The first account to sign in becomes the Operations Manager.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs
                  value={view}
                  onValueChange={(v) => setView(v as AuthView)}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="login">Sign in</TabsTrigger>
                    <TabsTrigger value="signup">Create account</TabsTrigger>
                  </TabsList>
                  <TabsContent value="login" className="mt-4">
                    <SignInForm localOnly onPasswordSignIn={signIn} />
                  </TabsContent>
                  <TabsContent value="signup" className="mt-4">
                    <SignUpForm
                      onSubmit={signUp}
                      onSwitchToSignIn={() => setView('login')}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </>
        )}

        <p className="text-center text-xs text-sidebar-foreground/60">
          All data in this application is synthetic and generated for
          demonstration purposes.
        </p>
      </div>
    </div>
  );
}
