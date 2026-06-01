'use client';

import { useState, useCallback } from 'react';

interface PoolStats {
  reserveA: string;
  reserveB: string;
  totalLiquidity: string;
}

interface LiquidityPoolSwapProps {
  poolStats?: PoolStats;
  onSwap?: (tokenIn: 'bst' | 'xlm', amountIn: string, minOut: string) => Promise<string>;
  onAddLiquidity?: (amountA: string, amountB: string) => Promise<void>;
  onRemoveLiquidity?: (shares: string) => Promise<void>;
  walletConnected?: boolean;
}

type Tab = 'swap' | 'add' | 'remove';

export default function LiquidityPoolSwap({
  poolStats,
  onSwap,
  onAddLiquidity,
  onRemoveLiquidity,
  walletConnected = false,
}: LiquidityPoolSwapProps) {
  const [tab, setTab]           = useState<Tab>('swap');
  const [tokenIn, setTokenIn]   = useState<'bst' | 'xlm'>('bst');
  const [amountIn, setAmountIn] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [amountA, setAmountA]   = useState('');
  const [amountB, setAmountB]   = useState('');
  const [shares, setShares]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const estimatedOut = useCallback(() => {
    if (!poolStats || !amountIn || isNaN(Number(amountIn))) return '—';
    const rIn  = tokenIn === 'bst' ? Number(poolStats.reserveA) : Number(poolStats.reserveB);
    const rOut = tokenIn === 'bst' ? Number(poolStats.reserveB) : Number(poolStats.reserveA);
    if (rIn <= 0 || rOut <= 0) return '—';
    const fee     = 0.003;
    const aInFee  = Number(amountIn) * (1 - fee);
    const out     = (rOut * aInFee) / (rIn + aInFee);
    return out.toFixed(6);
  }, [poolStats, amountIn, tokenIn]);

  const minOut = useCallback(() => {
    const est = estimatedOut();
    if (est === '—') return '0';
    return (Number(est) * (1 - Number(slippage) / 100)).toFixed(6);
  }, [estimatedOut, slippage]);

  const handleSwap = async () => {
    if (!onSwap || !amountIn) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const out = await onSwap(tokenIn, amountIn, minOut());
      setResult(`Swapped → ${out} ${tokenIn === 'bst' ? 'XLM' : 'BST'}`);
      setAmountIn('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Swap failed');
    } finally { setLoading(false); }
  };

  const handleAdd = async () => {
    if (!onAddLiquidity || !amountA || !amountB) return;
    setLoading(true); setError(null); setResult(null);
    try {
      await onAddLiquidity(amountA, amountB);
      setResult('Liquidity added successfully');
      setAmountA(''); setAmountB('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Add liquidity failed');
    } finally { setLoading(false); }
  };

  const handleRemove = async () => {
    if (!onRemoveLiquidity || !shares) return;
    setLoading(true); setError(null); setResult(null);
    try {
      await onRemoveLiquidity(shares);
      setResult('Liquidity removed successfully');
      setShares('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove liquidity failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] p-6 max-w-md w-full shadow-2xl">
      {/* Pool stats */}
      {poolStats && (
        <div className="mb-5 grid grid-cols-3 gap-3 text-center text-xs">
          {[
            { label: 'BST Reserve', value: poolStats.reserveA },
            { label: 'XLM Reserve', value: poolStats.reserveB },
            { label: 'LP Tokens',   value: poolStats.totalLiquidity },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-white/5 border border-white/10 p-3">
              <p className="text-white/40 uppercase tracking-widest mb-1">{label}</p>
              <p className="text-white font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div role="tablist" className="flex rounded-xl bg-white/10 p-1 gap-1 mb-5">
        {(['swap', 'add', 'remove'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setError(null); setResult(null); }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold capitalize transition-all ${tab === t ? 'bg-indigo-600 text-white shadow' : 'text-white/50 hover:text-white/80'}`}>
            {t === 'add' ? 'Add Liquidity' : t === 'remove' ? 'Remove' : 'Swap'}
          </button>
        ))}
      </div>

      {/* Swap tab */}
      {tab === 'swap' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <select value={tokenIn} onChange={(e) => setTokenIn(e.target.value as 'bst' | 'xlm')}
              className="rounded-lg bg-white/10 border border-white/20 text-white text-sm px-3 py-2 focus:outline-none">
              <option value="bst">BST → XLM</option>
              <option value="xlm">XLM → BST</option>
            </select>
            <input type="number" min="0" placeholder="Amount in" value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              className="flex-1 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30 text-sm px-3 py-2 focus:outline-none focus:border-indigo-400" />
          </div>
          <div className="flex justify-between text-xs text-white/50 px-1">
            <span>Est. out: <span className="text-emerald-400 font-medium">{estimatedOut()} {tokenIn === 'bst' ? 'XLM' : 'BST'}</span></span>
            <span>Min out: <span className="text-white/70">{minOut()}</span></span>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/50">
            <span>Slippage</span>
            {['0.1', '0.5', '1.0'].map((s) => (
              <button key={s} onClick={() => setSlippage(s)}
                className={`px-2 py-1 rounded-lg border text-xs transition-all ${slippage === s ? 'border-indigo-400 text-indigo-400' : 'border-white/20 hover:border-white/40'}`}>
                {s}%
              </button>
            ))}
          </div>
          <button onClick={handleSwap} disabled={loading || !walletConnected || !amountIn}
            className="w-full rounded-xl py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            {!walletConnected ? 'Connect Wallet' : loading ? 'Swapping…' : 'Swap'}
          </button>
        </div>
      )}

      {/* Add liquidity tab */}
      {tab === 'add' && (
        <div className="space-y-4">
          <input type="number" min="0" placeholder="BST amount" value={amountA} onChange={(e) => setAmountA(e.target.value)}
            className="w-full rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30 text-sm px-3 py-2 focus:outline-none focus:border-emerald-400" />
          <input type="number" min="0" placeholder="XLM amount" value={amountB} onChange={(e) => setAmountB(e.target.value)}
            className="w-full rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30 text-sm px-3 py-2 focus:outline-none focus:border-emerald-400" />
          <button onClick={handleAdd} disabled={loading || !walletConnected || !amountA || !amountB}
            className="w-full rounded-xl py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            {loading ? 'Adding…' : 'Add Liquidity'}
          </button>
        </div>
      )}

      {/* Remove liquidity tab */}
      {tab === 'remove' && (
        <div className="space-y-4">
          <input type="number" min="0" placeholder="LP token shares to burn" value={shares} onChange={(e) => setShares(e.target.value)}
            className="w-full rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30 text-sm px-3 py-2 focus:outline-none focus:border-rose-400" />
          <button onClick={handleRemove} disabled={loading || !walletConnected || !shares}
            className="w-full rounded-xl py-3 text-sm font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            {loading ? 'Removing…' : 'Remove Liquidity'}
          </button>
        </div>
      )}

      {result && <p role="status" className="mt-3 text-xs text-emerald-400 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2">{result}</p>}
      {error  && <p role="alert"  className="mt-3 text-xs text-rose-400 rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2">⚠ {error}</p>}
    </div>
  );
}
