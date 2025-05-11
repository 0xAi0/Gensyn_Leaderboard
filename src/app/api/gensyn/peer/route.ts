import { NextResponse, type NextRequest } from 'next/server';
import type { PeerData } from '@/types';

const GENSYN_API_BASE_URL = 'https://dashboard.gensyn.ai/api/v1/peer?name=';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const name = searchParams.get('name');

  if (!name) {
    return NextResponse.json({ message: 'Peer name query parameter is required' }, { status: 400 });
  }

  try {
    const externalApiResponse = await fetch(`${GENSYN_API_BASE_URL}${encodeURIComponent(name)}`);
    
    if (!externalApiResponse.ok) {
      let errorMessage = `Failed to fetch data from Gensyn API for peer "${name}". Status: ${externalApiResponse.status}`;
      try {
        // Try to parse error from Gensyn API if it returns JSON
        const errorData = await externalApiResponse.json();
        if (errorData && typeof errorData.message === 'string') {
          errorMessage = errorData.message; // Use Gensyn's error message
        } else if (externalApiResponse.statusText) {
            errorMessage = `Gensyn API Error: ${externalApiResponse.statusText}`;
        }
      } catch (e) {
        // Failed to parse JSON from Gensyn API error response, stick with the status code error
      }
      // Return the error from Gensyn API to the client
      return NextResponse.json({ message: errorMessage }, { status: externalApiResponse.status });
    }
    
    const data: any = await externalApiResponse.json();

    // Validate the structure of the data from Gensyn API
    if (!data || typeof data.peerId !== 'string' || typeof data.peerName !== 'string' || typeof data.reward !== 'number' || typeof data.score !== 'number' || typeof data.online !== 'boolean') {
        console.error(`Incomplete or malformed data received from Gensyn API for peer "${name}":`, data);
        return NextResponse.json({ message: `Incomplete or malformed data received from Gensyn API for peer "${name}".` }, { status: 502 }); // Bad Gateway
    }
    
    // Ensure PeerData type conformity
    const peerData: PeerData = {
        peerId: data.peerId,
        peerName: data.peerName,
        reward: data.reward,
        score: data.score,
        online: data.online,
        // queryName is not part of the external API response, it's added client-side if needed
    };
    return NextResponse.json(peerData);

  } catch (error) {
    // This catch block handles errors during the fetch to GENSYN_API_BASE_URL itself (e.g., network error, DNS failure)
    // or if externalApiResponse.json() fails due to non-JSON response.
    console.error(`Error in API route proxying Gensyn API for ${name}:`, error);
    
    let message = 'An unexpected error occurred while trying to fetch peer data via the proxy.';
    let status = 500;

    if (error instanceof TypeError && error.message === 'Failed to fetch') {
        // This specific error occurs if the fetch operation itself fails at the network level (e.g. DNS resolution, no route to host)
        // when the Next.js server tries to reach the Gensyn API.
        message = `The server could not connect to the Gensyn API. The API might be down or there's a network issue.`;
        status = 503; // Service Unavailable
    } else if (error instanceof Error) {
        // For other generic errors, avoid exposing too much internal detail.
        // message = error.message; // Could be too verbose or sensitive
    }

    return NextResponse.json({ message }, { status });
  }
}
