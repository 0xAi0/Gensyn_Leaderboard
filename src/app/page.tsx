
"use client";

import type * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { PeerInputForm } from '@/components/PeerInputForm';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { Button } from '@/components/ui/button';
import type { PeerData, SortableKey } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw } from 'lucide-react';
import { 
  addOrUpdatePeerInFirestore, 
  getAllPeersFromFirestore, 
  refreshPeerDataInFirestore 
} from '@/lib/firebase';

const isAdmin = false; 
const REFRESH_COOLDOWN_HOURS = 6;
const REFRESH_COOLDOWN_MS = REFRESH_COOLDOWN_HOURS * 60 * 60 * 1000;

export default function Home() {
  const [peers, setPeers] = useState<PeerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingPeer, setIsAddingPeer] = useState(false);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false); // Kept for potential admin use
  const [refreshingPeerId, setRefreshingPeerId] = useState<string | null>(null);

  const [sortConfig, setSortConfig] = useState<{ key: SortableKey | null; direction: 'ascending' | 'descending' } | null>(null);
  const { toast } = useToast();

  const updatePeersState = useCallback((updatedOrNewPeer: PeerData) => {
    setPeers(prevPeers => {
      const existingPeerIndex = prevPeers.findIndex(p => p.id === updatedOrNewPeer.id);
      if (existingPeerIndex > -1) {
        const newPeers = [...prevPeers];
        newPeers[existingPeerIndex] = updatedOrNewPeer;
        return newPeers;
      }
      return [...prevPeers, updatedOrNewPeer];
    });
  }, []);

  // Load initial peers from Firestore
  useEffect(() => {
    async function loadPeers() {
      setIsLoading(true);
      try {
        const firestorePeers = await getAllPeersFromFirestore();
        setPeers(firestorePeers);
      } catch (error: any) {
        console.error("Error loading peers from Firestore:", error);
        toast({
          title: "Error Loading Leaderboard",
          description: error.message || "Could not fetch leaderboard data from the database.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadPeers();
  }, [toast]);

  const handleAddPeer = async (queryName: string, gpu?: string) => {
    setIsAddingPeer(true);
    try {
      const newOrUpdatedPeer = await addOrUpdatePeerInFirestore(queryName, gpu);
      updatePeersState(newOrUpdatedPeer);
      toast({
        title: "Peer Added/Updated",
        description: `${newOrUpdatedPeer.peerName}'s data has been added/updated on the leaderboard.`,
      });
    } catch (error: any) {
      console.error(`Error adding/updating peer ${queryName}:`, error);
      toast({
        title: "Error",
        description: error.message || `Could not add or update ${queryName}.`,
        variant: "destructive",
      });
    } finally {
      setIsAddingPeer(false);
    }
  };

  const handleRefreshSinglePeer = async (peerToRefresh: PeerData) => {
    const now = Date.now();
    if (peerToRefresh.lastRefreshed && (now - peerToRefresh.lastRefreshed < REFRESH_COOLDOWN_MS)) {
      const timeLeftMs = REFRESH_COOLDOWN_MS - (now - peerToRefresh.lastRefreshed);
      const hoursLeft = Math.floor(timeLeftMs / (60 * 60 * 1000));
      const minutesLeft = Math.ceil((timeLeftMs % (60 * 60 * 1000)) / (60 * 1000));
      
      let timeRemainingStr = "";
      if (hoursLeft > 0) timeRemainingStr += `${hoursLeft}h `;
      if (minutesLeft > 0 || hoursLeft === 0) timeRemainingStr += `${minutesLeft}m`;
      if (!timeRemainingStr.trim()) timeRemainingStr = "a few moments";

      toast({
        title: "Refresh Cooldown",
        description: `Peer ${peerToRefresh.peerName} was refreshed recently. Please try again in approx. ${timeRemainingStr.trim()}.`,
      });
      return;
    }

    setRefreshingPeerId(peerToRefresh.id);
    try {
      const refreshedPeer = await refreshPeerDataInFirestore(peerToRefresh.id);
      updatePeersState(refreshedPeer);
      toast({
        title: "Peer Refreshed",
        description: `${refreshedPeer.peerName}'s data has been updated.`,
      });
    } catch (error: any) {
      console.error(`Error refreshing peer ${peerToRefresh.peerName}:`, error);
      toast({
        title: "Refresh Error",
        description: error.message || `Could not refresh data for ${peerToRefresh.peerName}.`,
        variant: "destructive",
      });
    } finally {
      setRefreshingPeerId(null);
    }
  };
  
  // Admin-only functionality - currently hidden as isAdmin is false
  const handleRefreshAllPeers = async () => {
    if (!isAdmin) return;
    if (peers.length === 0) {
      toast({ title: "No Peers", description: "There are no peers to refresh." });
      return;
    }
    setIsRefreshingAll(true);
    
    const refreshPromises = peers.map(peer => 
      refreshPeerDataInFirestore(peer.id)
        .then(refreshedPeer => ({ status: 'fulfilled' as const, value: refreshedPeer }))
        .catch(reason => ({ status: 'rejected' as const, reason, peerName: peer.peerName}))
    );
    
    const results = await Promise.all(refreshPromises);
    
    let successfulRefreshes = 0;
    const updatedPeersBatch: PeerData[] = [];

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        updatedPeersBatch.push(result.value);
        successfulRefreshes++;
      } else {
        toast({
            title: `Refresh Error for ${result.peerName}`,
            description: result.reason?.message || 'Unknown error',
            variant: "destructive",
        });
      }
    });

    // Batch update local state for performance if many peers
    setPeers(currentPeers => {
      const newPeersMap = new Map(currentPeers.map(p => [p.id, p]));
      updatedPeersBatch.forEach(p => newPeersMap.set(p.id, p));
      return Array.from(newPeersMap.values());
    });

    toast({
      title: "Refresh All Complete",
      description: `Successfully updated ${successfulRefreshes} of ${peers.length} peers.`,
    });
    setIsRefreshingAll(false);
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
        // Secondary sort by peerName if scores/rewards are equal
        if (a.peerName < b.peerName) return -1;
        if (a.peerName > b.peerName) return 1;
        return 0;
      });
    }
    return sortablePeers;
  }, [peers, sortConfig]);

  const requestSort = (key: SortableKey) => {
    let direction: 'ascending' | 'descending' = 'descending'; 
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'descending') {
      direction = 'ascending';
    } else if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      // Default back to descending if already ascending and clicked again
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
        <p className="text-muted-foreground">Track peer rewards and scores on the Gensyn network. Data is stored and shared among users.</p>
      </header>
      
      <main className="flex-grow">
        <PeerInputForm onAddPeer={handleAddPeer} isAdding={isAddingPeer} />

        {isAdmin && ( // "Refresh All" button is admin-only
          <div className="mb-6 flex justify-end">
            <Button 
              onClick={handleRefreshAllPeers} 
              disabled={isRefreshingAll || isLoading || peers.length === 0} 
              variant="outline"
            >
              {isRefreshingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh All (Admin)
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-primary dark:text-primary" />
          </div>
        ) : (
          <LeaderboardTable 
            peers={sortedPeers} 
            sortConfig={sortConfig} 
            onSort={requestSort}
            onRefreshPeer={handleRefreshSinglePeer}
            isRefreshingPeer={(peerId) => refreshingPeerId === peerId}
          />
        )}
      </main>
      
      <footer className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Gensyn Leaderboard. All rights reserved.</p>
         <p className="mt-1">Data fetched from Gensyn Dashboard API and stored collaboratively.</p>
      </footer>
    </div>
  );
}
