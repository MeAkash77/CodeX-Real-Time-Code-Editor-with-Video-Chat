import { NextResponse } from 'next/server';
import { KASCA_SERVER_MONITOR_ID } from '@/lib/constants';
import type { BetterStackResponse } from '@/components/status/types';

export async function GET() {
  try {
    // Debug: Check if env vars are present
    console.log('🔍 API Key present?', Boolean(process.env.BETTERSTACK_API_KEY));
    console.log('🔍 Monitor ID:', KASCA_SERVER_MONITOR_ID);

    const response = await fetch(
      `https://uptime.betterstack.com/api/v2/monitors/${KASCA_SERVER_MONITOR_ID}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.BETTERSTACK_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      // Log the exact HTTP status and response body from BetterStack
      const errText = await response.text();
      console.error(`BetterStack API Error ${response.status}: ${errText}`);
      throw new Error(`BetterStack request failed with ${response.status}`);
    }

    const data = (await response.json()) as BetterStackResponse;
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching server status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch server status' },
      { status: 500 }
    );
  }
}
