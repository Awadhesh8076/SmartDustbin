import React, { createContext, useContext, useState, useEffect } from 'react';
import { OperatingMode, DeviceStatusResponse, HealthResponse } from '../types/api';
import { api } from '../services/api';

interface HardwareContextType {
  activeMode: OperatingMode;
  deviceStatus: DeviceStatusResponse | null;
  health: HealthResponse | null;
  isLoading: boolean;
  refreshStatus: () => Promise<void>;
  switchMode: (mode: OperatingMode) => Promise<void>;
}

const HardwareContext = createContext<HardwareContextType | undefined>(undefined);

export const HardwareProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeMode, setActiveMode] = useState<OperatingMode>('SIMULATION');
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatusResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshStatus = async () => {
    try {
      const [hData, dData] = await Promise.all([
        api.getHealth().catch(() => null),
        api.getDeviceStatus().catch(() => null),
      ]);
      if (hData) setHealth(hData);
      if (dData) {
        setDeviceStatus(dData);
        setActiveMode(dData.active_mode);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = async (mode: OperatingMode) => {
    setIsLoading(true);
    try {
      const res = await api.setOperatingMode(mode);
      setActiveMode(res.active_mode);
      await refreshStatus();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <HardwareContext.Provider
      value={{
        activeMode,
        deviceStatus,
        health,
        isLoading,
        refreshStatus,
        switchMode,
      }}
    >
      {children}
    </HardwareContext.Provider>
  );
};

export const useHardware = (): HardwareContextType => {
  const context = useContext(HardwareContext);
  if (!context) {
    throw new Error('useHardware must be used within a HardwareProvider');
  }
  return context;
};
