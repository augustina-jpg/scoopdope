'use client';
import { useEffect, useRef, useState } from 'react';
import { useWalletStore } from '@/store/walletStore';
import { connectFreighter, fetchXlmBalance } from '@/lib/walletApi';

interface WalletMenuProps {
  onClose: () => void;
}

interface TxRecord {
  id: string;
  created_at: string;
  successful: boolean;
}

const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
const HORIZON_URL =
  NETWORK === 'mainnet'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org';
const EXPLORER_BASE =
  NETWORK === 'mainnet'
    ? 'https://stellar.expert/explorer/public/tx'
    : 'https://stellar.expert/explorer/testnet/tx';

export function WalletMenu({ onClose }: WalletMenuProps) {
  const { address, balance, balanceError, disconnect, setAddress, setBalance, setBalanceError, setIsConnecting, setError } = useWalletStore();
  const menuRef = useRef<HTMLDivElement>(null);
  const [txHistory, setTxHistory] = useState<TxRecord[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Fetch recent transactions
  useEffect(() => {
    if (!address) return;
    setTxLoading(true);
    fetch(`${HORIZON_URL}/accounts/${address}/transactions?limit=5&order=desc`)
      .then((r) => r.json())
      .then((data) => setTxHistory(data._embedded?.records ?? []))
      .catch(() => setTxHistory([]))
      .finally(() => setTxLoading(false));
  }, [address]);

  async function handleSwitch() {
    onClose();
    setIsConnecting(true);
    setError(null);
    try {
      const publicKey = await connectFreighter();
      setAddress(publicKey);
      try {
        const bal = await fetchXlmBalance(publicKey);
        setBalance(bal);
        setBalanceError(false);
      } catch {
        setBalance(null);
        setBalanceError(true);
      }
    } catch {
      setError('Failed to switch wallet.');
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleRetryBalance() {
    if (!address) return;
    try {
      const bal = await fetchXlmBalance(address);
      setBalance(bal);
      setBalanceError(false);
    } catch {
      setBalanceError(true);
    }
  }

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-1 w-80 bg-white border rounded-xl shadow-lg p-4 z-50 space-y-3"
      role="menu"
    >
      <div>
        <p className="text-xs text-gray-500 mb-0.5">Connected Wallet</p>
        <p className="font-mono text-xs break-all">{address}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">XLM Balance</p>
        {balanceError ? (
          <p className="text-sm text-gray-500">
            Balance unavailable{' '}
            <button className="text-blue-600 underline text-xs" onClick={handleRetryBalance}>Retry</button>
          </p>
        ) : (
          <p className="text-sm font-medium">{balance ?? '—'} XLM</p>
        )}
      </div>

      {/* Transaction history */}
      <div className="border-t pt-2">
        <p className="text-xs text-gray-500 mb-1">Recent Transactions</p>
        {txLoading ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : txHistory.length === 0 ? (
          <p className="text-xs text-gray-400">No transactions found</p>
        ) : (
          <ul className="space-y-1.5">
            {txHistory.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-2 text-xs">
                <span className={tx.successful ? 'text-green-600' : 'text-red-500'}>
                  {tx.successful ? '✅' : '❌'}
                </span>
                <span className="font-mono text-gray-600 flex-1 truncate">
                  {tx.id.slice(0, 8)}…{tx.id.slice(-6)}
                </span>
                <a
                  href={`${EXPLORER_BASE}/${tx.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline shrink-0"
                >
                  ↗
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-2 pt-2 border-t">
        <button
          className="flex-1 text-sm border rounded-lg py-1.5 hover:bg-gray-50 transition-colors"
          onClick={handleSwitch}
          role="menuitem"
        >
          Switch Wallet
        </button>
        <button
          className="flex-1 text-sm border border-red-200 text-red-600 rounded-lg py-1.5 hover:bg-red-50 transition-colors"
          onClick={() => { disconnect(); onClose(); }}
          role="menuitem"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
