import type { PeerData } from '@/types';

const API_BASE_URL = 'https://dashboard.gensyn.ai/api/v1/peer?name=';

export async function fetchPeerData(name: string): Promise<PeerData> {
  const response = await fetch(`${API_BASE_URL}${encodeURIComponent(name)}`);
  
  if (!response.ok) {
    let errorMessage = `Failed to fetch data for peer "${name}". Status: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData && typeof errorData.message === 'string') { // Check if message is a string
        errorMessage = errorData.message;
      } else if (response.statusText) {
        errorMessage = `Error: ${response.statusText}`;
      }
    } catch (e) {
      // Failed to parse JSON, stick with the status code error
    }
    throw new Error(errorMessage);
  }
  
  const data = await response.json();
  if (!data.peerId) { // Basic validation of API response structure
    throw new Error(`Incomplete data received from API for peer "${name}".`);
  }
  return data as PeerData;
}
