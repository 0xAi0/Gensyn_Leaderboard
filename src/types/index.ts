export interface PeerData {
  peerId: string;
  peerName: string; 
  reward: number;
  score: number;
  online: boolean;
  queryName?: string; 
  gpu?: string; // Added GPU field
}

// This type represents the data structure directly from the Gensyn API
export type ApiPeerData = Omit<PeerData, 'gpu' | 'queryName'>;

export type SortableKey = 'reward' | 'score';
