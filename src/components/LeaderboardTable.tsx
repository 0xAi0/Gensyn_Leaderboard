"use client";

import type * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, Users, HardDrive } from 'lucide-react'; // Added HardDrive for GPU
import type { PeerData, SortableKey } from '@/types';

interface LeaderboardTableProps {
  peers: PeerData[];
  sortConfig: { key: SortableKey | null; direction: 'ascending' | 'descending' } | null;
  onSort: (key: SortableKey) => void;
  onRefreshPeer: (queryName: string) => Promise<void>;
  isRefreshingPeer: (queryName: string) => boolean;
}

export function LeaderboardTable({ peers, sortConfig, onSort, onRefreshPeer, isRefreshingPeer }: LeaderboardTableProps) {
  const getSortIcon = (key: SortableKey) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    if (sortConfig.direction === 'ascending') {
      return <ArrowUp className="ml-2 h-4 w-4" />;
    }
    return <ArrowDown className="ml-2 h-4 w-4" />;
  };

  if (peers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-10 border border-dashed rounded-lg bg-card shadow-sm">
        <Users className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold mb-2 text-card-foreground">No Peers Yet</h3>
        <p className="text-muted-foreground">Add a peer using the form above to see their stats on the leaderboard.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border shadow-sm overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px] text-card-foreground">Peer Name</TableHead>
            <TableHead className="w-[150px] text-card-foreground">
              <div className="flex items-center">
                <HardDrive className="mr-2 h-4 w-4 text-muted-foreground" /> GPU
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-accent/50 transition-colors text-card-foreground"
              onClick={() => onSort('score')}
              aria-label="Sort by score"
            >
              <div className="flex items-center">
                Score {getSortIcon('score')}
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-accent/50 transition-colors text-card-foreground"
              onClick={() => onSort('reward')}
              aria-label="Sort by reward"
            >
              <div className="flex items-center">
                Reward {getSortIcon('reward')}
              </div>
            </TableHead>
            <TableHead className="text-card-foreground">Status</TableHead>
            <TableHead className="text-right text-card-foreground">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {peers.map((peer) => (
            <TableRow key={peer.peerId}>
              <TableCell className="font-medium text-card-foreground">{peer.peerName}</TableCell>
              <TableCell className="text-card-foreground text-sm">{peer.gpu || '-'}</TableCell>
              <TableCell className="text-card-foreground">{peer.score.toLocaleString()}</TableCell>
              <TableCell className="text-card-foreground">{peer.reward.toLocaleString()}</TableCell>
              <TableCell>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  peer.online ? 'bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100' : 'bg-red-100 text-red-700 dark:bg-red-700 dark:text-red-100'
                }`}>
                  {peer.online ? 'Online' : 'Offline'}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => onRefreshPeer(peer.queryName || peer.peerName)}
                  disabled={isRefreshingPeer(peer.queryName || peer.peerName)}
                  aria-label={`Refresh ${peer.peerName}`}
                  className="text-card-foreground hover:text-accent-foreground"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshingPeer(peer.queryName || peer.peerName) ? 'animate-spin' : ''}`} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
