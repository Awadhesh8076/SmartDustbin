import React, { useState, useEffect } from 'react';
import {
  Coins,
  Coffee,
  TreePine,
  CreditCard,
  Ticket,
  CheckCircle2,
  Copy,
  Check,
  RotateCw,
  Gift,
  ArrowUpRight,
  Sparkles,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { useRewards } from '../context/RewardsContext';
import { api } from '../services/api';
import {
  RewardCatalogItem,
  RewardClaimItem,
  RewardTransactionItem,
} from '../types/api';

const ICON_MAP: Record<string, any> = {
  'R1': Ticket,
  'R2': Coffee,
  'R3': TreePine,
  'R4': CreditCard,
};

export const RewardsPage: React.FC = () => {
  const { balance, totalEarned, totalSpent, refreshBalance } = useRewards();

  const [catalog, setCatalog] = useState<RewardCatalogItem[]>([]);
  const [claims, setClaims] = useState<RewardClaimItem[]>([]);
  const [transactions, setTransactions] = useState<RewardTransactionItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // Success modal/banner state
  const [lastClaimCode, setLastClaimCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [catRes, claimsRes, txnsRes] = await Promise.all([
        api.getRewardCatalog(),
        api.getRewardClaims(20),
        api.getRewardTransactions(20),
      ]);
      setCatalog(catRes.items);
      setClaims(claimsRes.claims);
      setTransactions(txnsRes.transactions);
      await refreshBalance();
    } catch (err: any) {
      console.error('Failed to load rewards data:', err);
      setErrorMessage('Could not load rewards catalog. Please check backend connection.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleClaim = async (rewardId: string) => {
    setClaimingId(rewardId);
    setErrorMessage(null);
    try {
      const res = await api.claimReward(rewardId);
      setLastClaimCode(res.claim_code);
      setClaimMessage(`Successfully redeemed ${res.reward_title}! Voucher code: ${res.claim_code}`);
      setCopiedCode(false);
      await refreshBalance();
      await loadData();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Redemption failed';
      setErrorMessage(msg);
    } finally {
      setClaimingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Coins className="w-6 h-6 text-amber-400" />
            Eco Rewards & Store
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Coins are credited strictly upon verified waste sorting: +5 Metal, +3 Plastic, +2 Dry, +1 Wet.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading}
          className="px-3.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600 text-xs font-semibold text-slate-300 flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Sync Wallet</span>
        </button>
      </div>

      {/* Wallet Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current Available Balance */}
        <div className="bg-gradient-to-br from-amber-950/40 via-slate-800/60 to-slate-800/40 border border-amber-600/40 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Spendable Balance</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Coins className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{balance} <span className="text-sm font-normal text-amber-400">Coins</span></div>
          <div className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Anti-duplicate protected ledger</span>
          </div>
        </div>

        {/* Total Earned */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lifetime Earned</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">+{totalEarned} <span className="text-sm font-normal text-slate-400">Coins</span></div>
          <div className="text-xs text-slate-400 mt-2">
            Earned from physical & simulated sorts
          </div>
        </div>

        {/* Total Redeemed */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Redeemed</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Gift className="w-4 h-4 text-purple-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">-{totalSpent} <span className="text-sm font-normal text-slate-400">Coins</span></div>
          <div className="text-xs text-slate-400 mt-2">
            Vouchers claimed in Eco Store
          </div>
        </div>
      </div>

      {/* Newly Claimed Voucher Banner */}
      {lastClaimCode && (
        <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900/80 to-slate-900 border border-emerald-500/60 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-xs font-semibold text-emerald-300">Voucher Successfully Generated!</div>
              <div className="text-sm text-slate-300">{claimMessage}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-4 py-2 rounded-xl bg-slate-950/80 border border-slate-700 font-mono text-base font-bold text-amber-300 tracking-wider">
              {lastClaimCode}
            </div>
            <button
              onClick={() => copyToClipboard(lastClaimCode)}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Copy Code"
            >
              {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Error Message Banner */}
      {errorMessage && (
        <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-4 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Eco Store Catalog */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Gift className="w-5 h-5 text-teal-400" />
            Eco Store Catalog
          </h3>
          <span className="text-xs text-slate-400">Instant Digital Redemption</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {catalog.map((item) => {
            const Icon = ICON_MAP[item.id] || Ticket;
            const canAfford = balance >= item.coin_cost;
            const isClaiming = claimingId === item.id;

            return (
              <div
                key={item.id}
                className="bg-slate-800/60 border border-slate-700/60 hover:border-slate-600 rounded-2xl p-5 flex flex-col justify-between shadow-lg transition-all group"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-slate-900/60 border border-slate-700/60 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                    <Icon className="w-6 h-6 text-amber-400" />
                  </div>
                  <h4 className="font-bold text-white text-base mb-1">{item.title}</h4>
                  <p className="text-xs text-slate-400 mb-4 leading-relaxed">{item.description}</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3 text-xs border-t border-slate-700/40 pt-3">
                    <span className="text-slate-400">Required:</span>
                    <span className="font-bold text-amber-300 font-mono text-sm">{item.coin_cost} Coins</span>
                  </div>

                  <button
                    disabled={!canAfford || isClaiming}
                    onClick={() => handleClaim(item.id)}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 ${
                      canAfford
                        ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20 cursor-pointer active:scale-95'
                        : 'bg-slate-800/40 border border-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isClaiming ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating Voucher...</span>
                      </>
                    ) : canAfford ? (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Redeem Voucher</span>
                      </>
                    ) : (
                      <span>Need {item.coin_cost - balance} More Coins</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Columns: Claimed Vouchers & Coins Transaction History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Claimed Vouchers */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 shadow-xl">
          <h3 className="font-semibold text-white text-base mb-4 flex items-center gap-2">
            <Ticket className="w-4 h-4 text-teal-400" />
            Claimed Vouchers ({claims.length})
          </h3>

          {claims.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              No rewards claimed yet. Accumulate coins through waste sorting to redeem items!
            </div>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {claims.map((claim) => (
                <div
                  key={claim.id}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-white">{claim.reward_title}</div>
                    <div className="text-[11px] text-slate-400">
                      Cost: {claim.coin_cost} Coins • {new Date(claim.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 font-mono font-bold text-amber-300">
                      {claim.claim_code}
                    </span>
                    <button
                      onClick={() => copyToClipboard(claim.claim_code)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                      title="Copy"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coin Transaction Ledger */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 shadow-xl">
          <h3 className="font-semibold text-white text-base mb-4 flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            Verified Coin Credits ({transactions.length})
          </h3>

          {transactions.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              No coin transactions recorded yet. Sort items to earn coins!
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {transactions.map((txn) => (
                <div
                  key={txn.id}
                  className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <div>
                      <span className="font-semibold text-white">Sorted {txn.category}</span>
                      <div className="text-[10px] text-slate-500">
                        {new Date(txn.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-400 font-mono">+{txn.coins_awarded} Coins</div>
                    <div className="text-[10px] text-slate-500">Balance: {txn.balance_after}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
