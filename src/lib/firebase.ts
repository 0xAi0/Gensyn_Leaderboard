'use server';
import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  where, 
  Firestore,
  DocumentReference,
  DocumentData,
  writeBatch,
  Timestamp
} from "firebase/firestore";
import type { PeerData, ApiPeerData } from '@/types';
import { fetchPeerData as fetchFromGensynApi } from '@/lib/api';

// IMPORTANT: Replace with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "YOUR_APP_ID"
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const db: Firestore = getFirestore(app);
const peersCollectionName = "leaderboardPeers";
const peersCollectionRef = collection(db, peersCollectionName);

/**
 * Adds a new peer to Firestore or updates an existing one based on Gensyn's peerId.
 * Fetches fresh data from Gensyn API.
 * @param queryName The name/identifier to query the Gensyn API.
 * @param gpu Optional GPU information for the peer.
 * @returns The added or updated PeerData object including its Firestore ID.
 */
export async function addOrUpdatePeerInFirestore(queryName: string, gpu?: string): Promise<PeerData> {
  const apiData = await fetchFromGensynApi(queryName); // Fetch latest data from Gensyn

  const q = query(peersCollectionRef, where("peerId", "==", apiData.peerId));
  const querySnapshot = await getDocs(q);

  const dataForFirestore: Omit<PeerData, 'id'> = {
    ...apiData,
    queryName: queryName, // Store/update the queryName used for this operation
    gpu: gpu?.trim() || '', // Store new GPU or ensure it's an empty string
    lastRefreshed: Date.now(),
  };

  if (!querySnapshot.empty) {
    // Peer exists, update it
    const docRef = querySnapshot.docs[0].ref;
    // If GPU is not provided in this update, keep the existing one.
    if (gpu === undefined && querySnapshot.docs[0].data().gpu) {
      dataForFirestore.gpu = querySnapshot.docs[0].data().gpu;
    }
    await updateDoc(docRef, dataForFirestore);
    return { ...dataForFirestore, id: docRef.id };
  } else {
    // New peer, add it
    const docRef = await addDoc(peersCollectionRef, dataForFirestore);
    return { ...dataForFirestore, id: docRef.id };
  }
}

/**
 * Fetches all peers from the Firestore leaderboard.
 * @returns A promise that resolves to an array of PeerData.
 */
export async function getAllPeersFromFirestore(): Promise<PeerData[]> {
  const querySnapshot = await getDocs(peersCollectionRef);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      peerId: data.peerId,
      peerName: data.peerName,
      reward: data.reward,
      score: data.score,
      online: data.online,
      queryName: data.queryName,
      gpu: data.gpu,
      lastRefreshed: data.lastRefreshed,
    } as PeerData;
  });
}

/**
 * Refreshes a specific peer's data from Gensyn and updates it in Firestore.
 * @param firestoreDocId The Firestore document ID of the peer to refresh.
 * @returns The updated PeerData object.
 */
export async function refreshPeerDataInFirestore(firestoreDocId: string): Promise<PeerData> {
  const docRef = doc(db, peersCollectionName, firestoreDocId);
  const docSnap = await getDocs(query(peersCollectionRef, where("__name__", "==", firestoreDocId))); // A bit verbose to get typed data

  if (docSnap.empty) {
    throw new Error(`Peer with Firestore ID ${firestoreDocId} not found.`);
  }
  const existingPeerData = { id: docSnap.docs[0].id, ...docSnap.docs[0].data() } as PeerData;
  
  // Fetch fresh data from Gensyn using the stored queryName
  const apiData = await fetchFromGensynApi(existingPeerData.queryName);

  const updatedPeerData: Partial<Omit<PeerData, 'id' | 'gpu' | 'queryName'>> & { lastRefreshed: number } = {
    ...apiData, // Update with fresh data from Gensyn
    lastRefreshed: Date.now(),
  };

  await updateDoc(docRef, updatedPeerData);

  // Return the full peer data, merging new API data with existing GPU/queryName
  return {
    ...existingPeerData,
    ...apiData,
    lastRefreshed: updatedPeerData.lastRefreshed,
  };
}
