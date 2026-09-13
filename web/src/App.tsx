import { ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { Layout } from './components/Layout';
import { AuthProvider, RequireAuth } from './hooks/useAuth';
import { OverviewPage } from './features/overview/OverviewPage';
import { ServerDetailPage } from './features/servers/ServerDetailPage';
import { AlertRulesPage } from './features/alerts/AlertRulesPage';
import { IncidentsPage } from './features/incidents/IncidentsPage';
import { IncidentDetailPage } from './features/incidents/IncidentDetailPage';
import { ChecksPage } from './features/checks/ChecksPage';
import { LoginPage } from './features/auth/LoginPage';

const queryClient = new QueryClient();

function Protected({ children }: { children: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/"
              element={
                <Protected>
                  <Layout>
                    <OverviewPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/servers"
              element={
                <Protected>
                  <Layout>
                    <OverviewPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/servers/:serverId"
              element={
                <Protected>
                  <Layout>
                    <ServerDetailPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/incidents"
              element={
                <Protected>
                  <Layout>
                    <IncidentsPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/incidents/:incidentId"
              element={
                <Protected>
                  <Layout>
                    <IncidentDetailPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/alerts"
              element={
                <Protected>
                  <Layout>
                    <AlertRulesPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/checks"
              element={
                <Protected>
                  <Layout>
                    <ChecksPage />
                  </Layout>
                </Protected>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
