"use client";

import type * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { PeerInputForm } from '@/components/PeerInputForm';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { Button } from '@/components/ui/button';
import { fetchPeerData } from '@/lib/api';
import type { PeerData, SortableKey } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw } from 'lucide-react';
// import Image from 'next/image'; // Not used in this version

const LOCAL_STORAGE_KEY = 'gensynLeaderboardPeers';

export default function Home() {
  const [peers, setPeers] = useState<PeerData[]>([]);
  const [queryNames, setQueryNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingPeer, setIsAddingPeer] = useState(false);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [refreshingPeerName, setRefreshingPeerName] = useState<string | null>(null);

  const [sortConfig, setSortConfig] = useState<{ key: SortableKey | null; direction: 'ascending' | 'descending' } | null>(null);
  const { toast } = useToast();

  const updatePeerInList = useCallback((newPeerData: PeerData, queryNameUsed: string) => {
    setPeers(prevPeers => {
      const existingPeerIndex = prevPeers.findIndex(p => p.peerId === newPeerData.peerId);
      let updatedPeers;
      if (existingPeerIndex > -1) {
        updatedPeers = [...prevPeers];
        updatedPeers[existingPeerIndex] = { ...newPeerData, queryName: queryNameUsed };
      } else {
        updatedPeers = [...prevPeers, { ...newPeerData, queryName: queryNameUsed }];
      }
      return updatedPeers;
    });
  }, []);
  
  const handleFetchPeer = useCallback(async (name: string, isBulkOperation: boolean = false): Promise<PeerData | null> => {
    try {
      const data = await fetchPeerData(name);
      updatePeerInList(data, name);
      if(!isBulkOperation) {
        toast({
          title: "Peer Updated",
          description: `${data.peerName}'s data has been updated.`,
        });
      }
      return data;
    } catch (error: any) {
      console.error(`Error fetching peer ${name}:`, error);
      if(!isBulkOperation) {
        toast({
          title: "Error",
          description: error.message || `Could not fetch data for ${name}.`,
          variant: "destructive",
        });
      }
      return null;
    }
  }, [toast, updatePeerInList]);

  const addPeer = async (name: string) => {
    setIsAddingPeer(true);
    const fetchedPeerData = await handleFetchPeer(name);
    setIsAddingPeer(false);

    if (fetchedPeerData) {
      setQueryNames(prevQueryNames => {
        const newQueryNames = Array.from(new Set([...prevQueryNames, name]));
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newQueryNames));
        return newQueryNames;
      });
    }
  };

  const refreshSinglePeer = async (name: string) => {
    setRefreshingPeerName(name);
    await handleFetchPeer(name);
    setRefreshingPeerName(null);
  };
  
  const refreshMultiplePeers = useCallback(async (namesToRefresh: string[], isInitialLoad: boolean = false) => {
    if (!isInitialLoad) setIsRefreshingAll(true); else setIsLoading(true);
    
    const fetchPromises = namesToRefresh.map(name => 
      fetchPeerData(name)
        .then(data => ({ status: 'fulfilled' as const, value: data, queryName: name }))
        .catch(reason => ({ status: 'rejected' as const, reason, queryName: name }))
    );
    
    const results = await Promise.all(fetchPromises);

    let successfulFetches = 0;
    const newPeersData: PeerData[] = [];
    const errors: {queryName: string, message: string}[] = [];

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        newPeersData.push({ ...result.value, queryName: result.queryName });
        successfulFetches++;
      } else {
        console.error(`Error fetching peer ${result.queryName} during bulk refresh:`, result.reason);
        errors.push({queryName: result.queryName, message: result.reason?.message || 'Unknown error'});
      }
    });

    // Batch update peers state to avoid multiple re-renders
    setPeers(prevPeers => {
      const peerMap = new Map(prevPeers.map(p => [p.peerId, p]));
      newPeersData.forEach(newPeer => peerMap.set(newPeer.peerId, newPeer));
      return Array.from(peerMap.values());
    });
    
    if (!isInitialLoad) {
      toast({
        title: "Refresh Complete",
        description: `Successfully updated ${successfulFetches} of ${namesToRefresh.length} peers.`,
      });
      errors.forEach(err => {
        toast({
            title: `Refresh Error for ${err.queryName}`,
            description: err.message,
            variant: "destructive",
        });
      });
      setIsRefreshingAll(false);
    } else {
        if (namesToRefresh.length > 0 && successfulFetches === 0 && errors.length > 0) {
             toast({
                title: "Initial Load Failed",
                description: "Could not fetch data for any stored peers. Please check console for details.",
                variant: "destructive",
            });
        }
      setIsLoading(false);
    }
  }, [toast]);

  // Load peers from localStorage on initial mount
  useEffect(() => {
    const storedQueryNamesString = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedQueryNamesString) {
      try {
        const storedQueryNames: string[] = JSON.parse(storedQueryNamesString);
        if (Array.isArray(storedQueryNames)) {
            setQueryNames(storedQueryNames);
            if (storedQueryNames.length > 0) {
              refreshMultiplePeers(storedQueryNames, true);
            } else {
              setIsLoading(false);
            }
        } else {
             localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear corrupted data
             setIsLoading(false);
        }
      } catch (e) {
        console.error("Failed to parse localStorage data:", e);
        localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear corrupted data
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // refreshMultiplePeers is memoized and safe

  const refreshAllPeers = async () => {
    if (queryNames.length === 0) {
      toast({ title: "No Peers", description: "There are no peers to refresh." });
      return;
    }
    await refreshMultiplePeers(queryNames);
  };

  const sortedPeers = useMemo(() => {
    let sortablePeers = [...peers];
    if (sortConfig !== null && sortConfig.key) {
      sortablePeers.sort((a, b) => {
        const valA = a[sortConfig.key!];
        const valB = b[sortConfig.key!];
        
        if (typeof valA === 'number' && typeof valB === 'number') {
            if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortablePeers;
  }, [peers, sortConfig]);

  const requestSort = (key: SortableKey) => {
    let direction: 'ascending' | 'descending' = 'descending'; // Default to descending for scores/rewards
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'descending') {
      direction = 'ascending';
    } else if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="container mx-auto p-4 md:p-8 min-h-screen flex flex-col">
      <header className="mb-8 text-center">
        <div className="flex items-center justify-center mb-2">
           <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-3 text-primary dark:text-primary">
            <path d="M50 5C25.16 5 5 25.16 5 50C5 74.84 25.16 95 50 95C74.84 95 95 74.84 95 50C95 25.16 74.84 5 50 5ZM72.5 72.5L50 58.82L27.5 72.5L33.82 47.5L15 31.18L40.68 30L50 5.82L59.32 30L85 31.18L66.18 47.5L72.5 72.5Z" fill="currentColor"/>
          </svg>
          <h1 className="text-4xl font-bold text-foreground">Gensyn Leaderboard</h1>
        </div>
        <p className="text-muted-foreground">Track peer rewards and scores on the Gensyn network.</p>
      </header>
      
      <main className="flex-grow">
        <PeerInputForm onAddPeer={addPeer} isAdding={isAddingPeer} />

        <div className="mb-6 flex justify-end">
          <Button onClick={refreshAllPeers} disabled={isRefreshingAll || isLoading || queryNames.length === 0} variant="outline">
            {isRefreshingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh All
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-primary dark:text-primary" />
          </div>
        ) : (
          <LeaderboardTable 
            peers={sortedPeers} 
            sortConfig={sortConfig} 
            onSort={requestSort}
            onRefreshPeer={refreshSinglePeer}
            isRefreshingPeer={(name) => refreshingPeerName === name}
          />
        )}
      </main>
      
      <footer className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Gensyn Leaderboard. All rights reserved.</p>
         <p className="mt-1">Data fetched from Gensyn Dashboard API.</p>
      </footer>
    </div>
  );
}
