export interface PeerData {
  peerId: string;
  peerName: string; 
  reward: number;
  score: number;
  online: boolean;
  queryName?: string; 
}

export type SortableKey = 'reward' | 'score';
