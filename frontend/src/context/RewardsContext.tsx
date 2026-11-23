import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface RewardsContextType {
  balance: number;
  totalEarned: number;
  totalSpent: number;
  refreshBalance: () => Promise<void>;
  addOptimisticCoins: (amount: number) => void;
}

const RewardsContext = createContext<RewardsContextType | undefined>(undefined);

export const RewardsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [balance, setBalance] = useState<number>(0);
  const [totalEarned, setTotalEarned] = useState<number>(0);
  const [totalSpent, setTotalSpent] = useState<number>(0);

  const refreshBalance = async () => {
    try {
      const res = await axios.get('/api/rewards/balance').catch(() => null);
      if (res && res.data) {
        setBalance(res.data.balance || 0);
        setTotalEarned(res.data.total_earned || 0);
        setTotalSpent(res.data.total_spent || 0);
      }
    } catch {
      // Fallback
    }
  };

  const addOptimisticCoins = (amount: number) => {
    setBalance((prev) => prev + amount);
    setTotalEarned((prev) => prev + amount);
  };

  useEffect(() => {
    refreshBalance();
  }, []);

  return (
    <RewardsContext.Provider
      value={{
        balance,
        totalEarned,
        totalSpent,
        refreshBalance,
        addOptimisticCoins,
      }}
    >
      {children}
    </RewardsContext.Provider>
  );
};

export const useRewards = (): RewardsContextType => {
  const context = useContext(RewardsContext);
  if (!context) {
    throw new Error('useRewards must be used within a RewardsProvider');
  }
  return context;
};
