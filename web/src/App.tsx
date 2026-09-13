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
import { UsersPage } from './features/users/UsersPage';
import { NotificationsPage } from './features/notifications/NotificationsPage';
import { AuditLogsPage } from './features/audit/AuditLogsPage';
import { MetricsExplorerPage } from './features/metrics/MetricsExplorerPage';
import { ServicesPage } from './features/services/ServicesPage';
import { InfrastructurePage } from './features/infrastructure/InfrastructurePage';
import { CentralLogsPage } from './features/logs/CentralLogsPage';
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
              path="/metrics"
              element={
                <Protected>
                  <Layout>
                    <MetricsExplorerPage />
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

            <Route
              path="/notifications"
              element={
                <Protected>
                  <Layout>
                    <NotificationsPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/users"
              element={
                <Protected>
                  <Layout>
                    <UsersPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/audit"
              element={
                <Protected>
                  <Layout>
                    <AuditLogsPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/services"
              element={
                <Protected>
                  <Layout>
                    <ServicesPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/infrastructure"
              element={
                <Protected>
                  <Layout>
                    <InfrastructurePage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/logs"
              element={
                <Protected>
                  <Layout>
                    <CentralLogsPage />
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
