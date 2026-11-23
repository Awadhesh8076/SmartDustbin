import axios from 'axios';
import {
  HealthResponse,
  DeviceStatusResponse,
  DevicePingResponse,
  SettingsResponse,
  DetectionResult,
  DetectionHistoryResponse,
  TeachResponse,
  LearningSamplesResponse,
  ConfusionMatrixResponse,
  OperatingMode,
  WasteCategory,
  SortingExecuteResponse,
  SortingHistoryResponse,
  SortingStatsResponse,
  SortingCommandDetails,
  RewardBalanceResponse,
  RewardCatalogResponse,
  RewardClaimResponse,
  RewardClaimsResponse,
  RewardTransactionsResponse,
  DashboardStatsResponse,
  DashboardRecentActivityResponse,
  AnalyticsTrendsResponse,
} from '../types/api';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

export const api = {
  // Health
  getHealth: async (): Promise<HealthResponse> => {
    const res = await apiClient.get<HealthResponse>('/health');
    return res.data;
  },

  // Devices & Hardware
  getDeviceStatus: async (): Promise<DeviceStatusResponse> => {
    const res = await apiClient.get<DeviceStatusResponse>('/devices/status');
    return res.data;
  },

  testDeviceConnection: async (device: 'CAM' | 'DEVKIT', ip?: string): Promise<DevicePingResponse> => {
    const res = await apiClient.post<DevicePingResponse>('/devices/test-connection', { device, ip });
    return res.data;
  },

  setOperatingMode: async (mode: OperatingMode): Promise<{ active_mode: OperatingMode; message: string }> => {
    const res = await apiClient.post<{ active_mode: OperatingMode; message: string }>('/devices/mode', { mode });
    return res.data;
  },

  captureCameraFrame: async (): Promise<DetectionResult> => {
    const res = await apiClient.post<DetectionResult>('/devices/camera/capture');
    return res.data;
  },

  // Detection API
  scanImage: async (imageFile: File | Blob, source: string = 'BROWSER_CAMERA'): Promise<DetectionResult> => {
    const formData = new FormData();
    formData.append('file', imageFile, 'capture.jpg');
    formData.append('source', source);

    const res = await apiClient.post<DetectionResult>('/detection/scan', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  getDetectionHistory: async (limit: number = 20, offset: number = 0, category?: string): Promise<DetectionHistoryResponse> => {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    if (category) params.append('category', category);

    const res = await apiClient.get<DetectionHistoryResponse>(`/detection/history?${params.toString()}`);
    return res.data;
  },

  // Learning API
  teachCategory: async (detectionId: string, confirmedCategory: WasteCategory): Promise<TeachResponse> => {
    const res = await apiClient.post<TeachResponse>('/learning/teach', {
      detection_id: detectionId,
      confirmed_category: confirmedCategory,
    });
    return res.data;
  },

  getLearningSamples: async (limit: number = 30, category?: string): Promise<LearningSamplesResponse> => {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    if (category) params.append('category', category);

    const res = await apiClient.get<LearningSamplesResponse>(`/learning/samples?${params.toString()}`);
    return res.data;
  },

  deleteLearningSample: async (sampleId: string): Promise<{ status: string; message: string }> => {
    const res = await apiClient.delete<{ status: string; message: string }>(`/learning/samples/${sampleId}`);
    return res.data;
  },

  getConfusionMatrix: async (): Promise<ConfusionMatrixResponse> => {
    const res = await apiClient.get<ConfusionMatrixResponse>('/learning/confusion-matrix');
    return res.data;
  },

  // Sorting API
  executeSorting: async (
    category: WasteCategory,
    detectionId?: string,
    modeOverride?: OperatingMode
  ): Promise<SortingExecuteResponse> => {
    const res = await apiClient.post<SortingExecuteResponse>('/sorting/execute', {
      category,
      detection_id: detectionId,
      mode_override: modeOverride,
    });
    return res.data;
  },

  getSortingHistory: async (limit: number = 20, offset: number = 0): Promise<SortingHistoryResponse> => {
    const res = await apiClient.get<SortingHistoryResponse>(`/sorting/history?limit=${limit}&offset=${offset}`);
    return res.data;
  },

  getSortingStats: async (): Promise<SortingStatsResponse> => {
    const res = await apiClient.get<SortingStatsResponse>('/sorting/stats');
    return res.data;
  },

  getSortingCommandDetails: async (commandId: string): Promise<SortingCommandDetails> => {
    const res = await apiClient.get<SortingCommandDetails>(`/sorting/commands/${commandId}`);
    return res.data;
  },

  // Rewards API
  getRewardBalance: async (): Promise<RewardBalanceResponse> => {
    const res = await apiClient.get<RewardBalanceResponse>('/rewards/balance');
    return res.data;
  },

  getRewardCatalog: async (): Promise<RewardCatalogResponse> => {
    const res = await apiClient.get<RewardCatalogResponse>('/rewards/catalog');
    return res.data;
  },

  claimReward: async (rewardId: string): Promise<RewardClaimResponse> => {
    const res = await apiClient.post<RewardClaimResponse>('/rewards/claim', { reward_id: rewardId });
    return res.data;
  },

  getRewardClaims: async (limit: number = 50): Promise<RewardClaimsResponse> => {
    const res = await apiClient.get<RewardClaimsResponse>(`/rewards/claims?limit=${limit}`);
    return res.data;
  },

  getRewardTransactions: async (limit: number = 50): Promise<RewardTransactionsResponse> => {
    const res = await apiClient.get<RewardTransactionsResponse>(`/rewards/history?limit=${limit}`);
    return res.data;
  },

  // Dashboard & Analytics API
  getDashboardStats: async (): Promise<DashboardStatsResponse> => {
    const res = await apiClient.get<DashboardStatsResponse>('/dashboard/stats');
    return res.data;
  },

  getRecentActivity: async (limit: number = 10): Promise<DashboardRecentActivityResponse> => {
    const res = await apiClient.get<DashboardRecentActivityResponse>(`/dashboard/recent-activity?limit=${limit}`);
    return res.data;
  },

  getAnalyticsTrends: async (): Promise<AnalyticsTrendsResponse> => {
    const res = await apiClient.get<AnalyticsTrendsResponse>('/analytics/trends');
    return res.data;
  },

  // Settings
  getSettings: async (): Promise<SettingsResponse> => {
    const res = await apiClient.get<SettingsResponse>('/settings');
    return res.data;
  },

  updateSettings: async (settings: Partial<SettingsResponse>): Promise<SettingsResponse> => {
    const res = await apiClient.put<SettingsResponse>('/settings', settings);
    return res.data;
  },

  createDatabaseBackup: async (): Promise<{ status: string; filename: string; size_bytes: number }> => {
    const res = await apiClient.post('/settings/backup');
    return res.data;
  },

  listDatabaseBackups: async (): Promise<{ backups: Array<{ filename: string; size_bytes: number; created_at: string }> }> => {
    const res = await apiClient.get('/settings/backups');
    return res.data;
  },

  checkDatabaseHealth: async (): Promise<{ status: string; details?: string[] }> => {
    const res = await apiClient.get('/settings/database-health');
    return res.data;
  },
};

export default api;
