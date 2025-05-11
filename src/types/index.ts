export interface ApiPeerData { // Data shape from Gensyn API
  peerId: string;
  peerName: string; 
  reward: number;
  score: number;
  online: boolean;
}

// PeerData is the shape stored in Firestore and used in the app's state.
// It includes the Gensyn data plus app-specific metadata.
export interface PeerData extends ApiPeerData {
  id: string; // Firestore document ID
  queryName: string; // The identifier/alias used to initially fetch and subsequently refresh this peer from Gensyn
  gpu?: string; // User-provided GPU information
  lastRefreshed: number; // Timestamp of the last successful data refresh from Gensyn
}

export type SortableKey = 'reward' | 'score';
