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
import { TracesPage } from './features/traces/TracesPage';
import { ServiceMapPage } from './features/servicemap/ServiceMapPage';
import { SLOPage } from './features/slo/SLOPage';
import { DashboardsPage } from './features/dashboards/DashboardsPage';
import { AgentsPage } from './features/agents/AgentsPage';
import { ContainersPage } from './features/containers/ContainersPage';
import { KubernetesPage } from './features/kubernetes/KubernetesPage';
import { RunbooksPage } from './features/automation/RunbooksPage';
import { IntegrationsPage } from './features/integrations/IntegrationsPage';
import { SecurityCenterPage } from './features/security/SecurityCenterPage';
import { OrganizationsPage } from './features/organizations/OrganizationsPage';
import { DeploymentsPage } from './features/deployments/DeploymentsPage';
import { DeveloperPlatformPage } from './features/developer/DeveloperPlatformPage';
import { ScaleBenchmarksPage } from './features/scale/ScaleBenchmarksPage';
import { CapacityFinOpsPage } from './features/capacity/CapacityFinOpsPage';
import { DatabasesPage } from './features/databases/DatabasesPage';
import { NetworkPage } from './features/network/NetworkPage';
import { BillingPlansPage } from './features/billing/BillingPlansPage';
import { CompliancePage } from './features/compliance/CompliancePage';
import { IntelligencePage } from './features/intelligence/IntelligencePage';
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

            <Route
              path="/traces"
              element={
                <Protected>
                  <Layout>
                    <TracesPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/service-map"
              element={
                <Protected>
                  <Layout>
                    <ServiceMapPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/slos"
              element={
                <Protected>
                  <Layout>
                    <SLOPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/dashboards"
              element={
                <Protected>
                  <Layout>
                    <DashboardsPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/agents"
              element={
                <Protected>
                  <Layout>
                    <AgentsPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/containers"
              element={
                <Protected>
                  <Layout>
                    <ContainersPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/kubernetes"
              element={
                <Protected>
                  <Layout>
                    <KubernetesPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/runbooks"
              element={
                <Protected>
                  <Layout>
                    <RunbooksPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/integrations"
              element={
                <Protected>
                  <Layout>
                    <IntegrationsPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/security"
              element={
                <Protected>
                  <Layout>
                    <SecurityCenterPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/organizations"
              element={
                <Protected>
                  <Layout>
                    <OrganizationsPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/deployments"
              element={
                <Protected>
                  <Layout>
                    <DeploymentsPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/changes"
              element={
                <Protected>
                  <Layout>
                    <DeploymentsPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/api-keys"
              element={
                <Protected>
                  <Layout>
                    <DeveloperPlatformPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/api-docs"
              element={
                <Protected>
                  <Layout>
                    <DeveloperPlatformPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/scale"
              element={
                <Protected>
                  <Layout>
                    <ScaleBenchmarksPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/capacity"
              element={
                <Protected>
                  <Layout>
                    <CapacityFinOpsPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/finops"
              element={
                <Protected>
                  <Layout>
                    <CapacityFinOpsPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/databases"
              element={
                <Protected>
                  <Layout>
                    <DatabasesPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/network"
              element={
                <Protected>
                  <Layout>
                    <NetworkPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/billing"
              element={
                <Protected>
                  <Layout>
                    <BillingPlansPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/plans"
              element={
                <Protected>
                  <Layout>
                    <BillingPlansPage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/compliance"
              element={
                <Protected>
                  <Layout>
                    <CompliancePage />
                  </Layout>
                </Protected>
              }
            />

            <Route
              path="/intelligence"
              element={
                <Protected>
                  <Layout>
                    <IntelligencePage />
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
