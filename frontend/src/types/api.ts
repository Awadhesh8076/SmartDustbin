export type WasteCategory = 'PLASTIC' | 'METAL' | 'WET' | 'DRY' | 'UNKNOWN';

export type OperatingMode = 'SIMULATION' | 'REAL_HARDWARE';

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  active_mode: OperatingMode;
  database: string;
  storage_ready: boolean;
}

export interface DeviceStatusResponse {
  active_mode: OperatingMode;
  esp32_cam_ip: string;
  esp32_devkit_ip: string;
  cam_status: string;
  devkit_status: string;
  last_cam_ping?: string | null;
  last_devkit_ping?: string | null;
}

export interface DevicePingResponse {
  device: 'CAM' | 'DEVKIT';
  ip: string;
  online: boolean;
  status_message: string;
}

export interface SettingsResponse {
  esp32_cam_ip: string;
  esp32_devkit_ip: string;
  camera_timeout_seconds: number;
  devkit_timeout_seconds: number;
  active_mode: OperatingMode;
  storage_path: string;
  database_url: string;
}

export interface DetectionResult {
  detection_id: string;
  image_url: string;
  category: WasteCategory;
  confidence: number;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  probabilities: Record<string, number>;
  is_known_in_memory: boolean;
  similarity: number;
  model_version: string;
  requires_user_label: boolean;
  message: string;
}

export interface DetectionHistoryItem {
  id: string;
  image_url: string;
  detected_category: WasteCategory;
  confidence: number;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  source: string;
  created_at: string;
}

export interface DetectionHistoryResponse {
  total: number;
  items: DetectionHistoryItem[];
}

export interface TeachResponse {
  status: string;
  sample_id: string;
  confirmed_category: WasteCategory;
  was_corrected: boolean;
  model_version: string;
  total_samples: number;
  immediate_new_prediction: WasteCategory;
  immediate_new_confidence: number;
  message: string;
}

export interface LearningSampleItem {
  id: string;
  detection_id?: string | null;
  image_url: string;
  predicted_category: string;
  confirmed_category: WasteCategory;
  was_corrected: boolean;
  original_confidence: number;
  model_version: string;
  created_at: string;
}

export interface LearningSamplesResponse {
  total: number;
  samples: LearningSampleItem[];
}

export interface ConfusionMatrixResponse {
  matrix: Record<string, Record<string, number>>;
  total_samples: number;
  accuracy_percent: number;
  categories: string[];
}

// Sorting Types
export interface SortingExecuteRequest {
  category: WasteCategory;
  detection_id?: string | null;
  mode_override?: OperatingMode | null;
}

export interface SortingExecuteResponse {
  command_id: string;
  detection_id?: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | 'UNKNOWN';
  category: WasteCategory;
  target_angle: number;
  mode: OperatingMode;
  coins_earned: number;
  balance_after: number;
  execution_duration_seconds: number;
  message: string;
}

export interface SortingCommandDetails {
  id: string;
  detection_id?: string | null;
  requested_category: string;
  target_chute_angle: number;
  mode: OperatingMode;
  status: string;
  device_ip?: string | null;
  retry_count: number;
  error_message?: string | null;
  sent_at: string;
  completed_at?: string | null;
}

export interface SortingHistoryItem {
  id: string;
  command_id: string;
  category: WasteCategory;
  mode: OperatingMode;
  result_status: string;
  execution_duration_seconds: number;
  coins_awarded: number;
  created_at: string;
}

export interface SortingHistoryResponse {
  total: number;
  items: SortingHistoryItem[];
}

export interface SortingStatsResponse {
  total_commands: number;
  total_successful: number;
  total_failed: number;
  success_rate_percent: number;
  category_counts: Record<string, number>;
  mode_counts: Record<string, number>;
}

// Reward Types
export interface RewardBalanceResponse {
  balance: number;
  total_earned: number;
  total_spent: number;
}

export interface RewardCatalogItem {
  id: string;
  title: string;
  description: string;
  coin_cost: number;
  icon: string;
}

export interface RewardCatalogResponse {
  items: RewardCatalogItem[];
}

export interface RewardClaimRequest {
  reward_id: string;
}

export interface RewardClaimResponse {
  claim_id: string;
  reward_id: string;
  reward_title: string;
  coin_cost: number;
  claim_code: string;
  status: string;
  balance_after: number;
  message: string;
  created_at: string;
}

export interface RewardClaimItem {
  id: string;
  reward_id: string;
  reward_title: string;
  coin_cost: number;
  claim_code: string;
  status: string;
  created_at: string;
}

export interface RewardClaimsResponse {
  total: number;
  claims: RewardClaimItem[];
}

export interface RewardTransactionItem {
  id: string;
  sorting_history_id: string;
  category: string;
  coins_awarded: number;
  balance_after: number;
  created_at: string;
}

export interface RewardTransactionsResponse {
  total: number;
  transactions: RewardTransactionItem[];
}

// Dashboard & Analytics Types
export interface DashboardStatsResponse {
  total_detected: number;
  total_sorted: number;
  total_failed_sorts: number;
  category_counts: Record<string, number>;
  category_sorted_counts: Record<string, number>;
  total_learned_samples: number;
  current_coin_balance: number;
  total_coins_earned: number;
  total_coins_spent: number;
  active_mode: OperatingMode;
  cam_status: string;
  devkit_status: string;
  model_version: string;
  estimated_accuracy: number;
}

export interface RecentActivityItem {
  id: string;
  type: 'DETECTION' | 'SORTING';
  category: string;
  status: string;
  detail: string;
  timestamp: string;
}

export interface DashboardRecentActivityResponse {
  activities: RecentActivityItem[];
}

export interface AnalyticsTrendsResponse {
  category_distribution: Record<string, number>;
  sorting_distribution: Record<string, number>;
  success_rate: number;
  total_coins_earned: number;
  total_claims: number;
  timeline: Array<{ day: string; detections: number; sorted: number }>;
}
