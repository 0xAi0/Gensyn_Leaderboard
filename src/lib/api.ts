import type { PeerData } from '@/types';

// The API base URL now points to our internal Next.js route handler
const API_BASE_URL = '/api/gensyn/peer?name='; // Relative path

export async function fetchPeerData(name: string): Promise<PeerData> {
  // The request now goes to our Next.js backend
  const response = await fetch(`${API_BASE_URL}${encodeURIComponent(name)}`);
  
  if (!response.ok) {
    let errorMessage = `Failed to fetch data for peer "${name}". Status: ${response.status}`;
    try {
      // Our proxy should return JSON errors with a 'message' field
      const errorData = await response.json();
      if (errorData && typeof errorData.message === 'string') {
        errorMessage = errorData.message;
      } else if (response.statusText) { // Fallback if proxy doesn't conform
        errorMessage = `Error: ${response.statusText}`;
      }
    } catch (e) {
      // Failed to parse JSON error from our proxy, stick with the status code error
      // This might happen if the proxy itself has an unhandled error and returns non-JSON
    }
    throw new Error(errorMessage);
  }
  
  const data = await response.json();
  
  // Basic validation of the data structure received from our proxy
  // The proxy should ideally ensure data integrity from the external API
  if (!data.peerId || typeof data.peerName === 'undefined' || typeof data.reward === 'undefined' || typeof data.score === 'undefined' || typeof data.online === 'undefined') { 
    throw new Error(`Incomplete or malformed data received for peer "${name}" from our API proxy.`);
  }
  return data as PeerData;
}
