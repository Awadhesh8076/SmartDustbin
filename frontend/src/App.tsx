import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HardwareProvider } from './context/HardwareContext';
import { RewardsProvider } from './context/RewardsContext';
import { AppLayout } from './components/layout/AppLayout';

import { DashboardPage } from './pages/DashboardPage';
import { DetectionPage } from './pages/DetectionPage';
import { LearningPage } from './pages/LearningPage';
import { SortingPage } from './pages/SortingPage';
import { RewardsPage } from './pages/RewardsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { DeviceManagementPage } from './pages/DeviceManagementPage';
import { SettingsPage } from './pages/SettingsPage';
import { MobileThrowPage } from './pages/MobileThrowPage';
import { DustbinQrPage } from './pages/DustbinQrPage';

export const App: React.FC = () => {
  return (
    <HardwareProvider>
      <RewardsProvider>
        <BrowserRouter>
          <Routes>
            {/* Dedicated Standalone Mobile User Flow (Accessed via QR scan) */}
            <Route path="/throw" element={<MobileThrowPage />} />

            {/* Admin & Full Dashboard Layout */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/detection" element={<DetectionPage />} />
              <Route path="/learning" element={<LearningPage />} />
              <Route path="/sorting" element={<SortingPage />} />
              <Route path="/rewards" element={<RewardsPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/devices" element={<DeviceManagementPage />} />
              <Route path="/qr" element={<DustbinQrPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </RewardsProvider>
    </HardwareProvider>
  );
};

export default App;
