import { useState, useEffect, useCallback } from 'react';

interface PhantomProvider {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  on: (event: string, callback: (...args: any[]) => void) => void;
  publicKey?: { toString: () => string } | null;
  isConnected?: boolean;
}

declare global {
  interface Window {
    solana?: PhantomProvider;
  }
}

export function usePhantomWallet() {
  const [wallet, setWallet] = useState<PhantomProvider | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const getProvider = () => {
      if ('solana' in window) {
        const provider = window.solana;
        if (provider?.isPhantom) {
          setWallet(provider);
          if (provider.isConnected && provider.publicKey) {
            setPublicKey(provider.publicKey.toString());
            setConnected(true);
          }
        }
      }
    };

    getProvider();

    // Handle account changes
    if (wallet) {
      wallet.on('accountChanged', (publicKey: any) => {
        if (publicKey) {
          setPublicKey(publicKey.toString());
          setConnected(true);
        } else {
          setPublicKey(null);
          setConnected(false);
        }
      });

      wallet.on('disconnect', () => {
        setPublicKey(null);
        setConnected(false);
      });
    }
  }, [wallet]);

  const connect = useCallback(async () => {
    if (!wallet) {
      throw new Error('Phantom wallet not found! Please install Phantom wallet extension.');
    }

    try {
      setConnecting(true);
      const response = await wallet.connect();
      setPublicKey(response.publicKey.toString());
      setConnected(true);
      return response;
    } catch (error) {
      console.error('Failed to connect to Phantom wallet:', error);
      throw error;
    } finally {
      setConnecting(false);
    }
  }, [wallet]);

  const disconnect = useCallback(async () => {
    if (wallet) {
      try {
        await wallet.disconnect();
        setPublicKey(null);
        setConnected(false);
      } catch (error) {
        console.error('Failed to disconnect from Phantom wallet:', error);
      }
    }
  }, [wallet]);

  const isPhantomInstalled = !!wallet;

  return {
    wallet,
    publicKey,
    connected,
    connecting,
    connect,
    disconnect,
    isPhantomInstalled,
  };
}