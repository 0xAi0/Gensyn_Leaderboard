
import type { ApiPeerData } from '@/types';

const getApiProxyBaseUrl = () => {
  if (typeof window === 'undefined') {
    // Running on the server, requires an absolute URL for self-API calls
    // Use NEXT_PUBLIC_APP_URL if available, otherwise default to localhost:9002 for development
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
    return `${appUrl}/api/gensyn/peer`;
  }
  // Running in the browser, can use a relative path
  return '/api/gensyn/peer';
};

export async function fetchPeerData(name: string): Promise<ApiPeerData> {
  const apiUrl = getApiProxyBaseUrl();
  const fullUrl = `${apiUrl}?name=${encodeURIComponent(name)}`;
  
  const response = await fetch(fullUrl);
  
  if (!response.ok) {
    let errorMessage = `Failed to fetch data for peer "${name}". Status: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData && typeof errorData.message === 'string') {
        errorMessage = errorData.message;
      } else if (response.statusText) { 
        errorMessage = `Error: ${response.statusText}`;
      }
    } catch (e) {
      // Failed to parse JSON error from our proxy
    }
    throw new Error(errorMessage);
  }
  
  const data = await response.json();
  
  // Validate the data structure received from our proxy
  if (typeof data.peerId !== 'string' || 
      typeof data.peerName !== 'string' || 
      typeof data.reward !== 'number' || 
      typeof data.score !== 'number' || 
      typeof data.online !== 'boolean') { 
    throw new Error(`Incomplete or malformed data received for peer "${name}" from our API proxy.`);
  }

  return {
    peerId: data.peerId,
    peerName: data.peerName,
    reward: data.reward,
    score: data.score,
    online: data.online,
  } as ApiPeerData;
}
