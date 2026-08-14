import React from 'react';
import DashboardClient from './DashboardClient';

// Ensure this page is rendered dynamically on every request (no cache)
export const revalidate = 0;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

async function fetchUpcomingMeetings() {
  try {
    const res = await fetch(`${API_BASE_URL}/meetings/upcoming/`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error('Failed to fetch upcoming meetings');
    }
    return await res.json();
  } catch (err) {
    console.error('Error fetching upcoming meetings on server:', err);
    return [];
  }
}

async function fetchRecentMeetings() {
  try {
    const res = await fetch(`${API_BASE_URL}/meetings/recent/`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error('Failed to fetch recent meetings');
    }
    return await res.json();
  } catch (err) {
    console.error('Error fetching recent meetings on server:', err);
    return [];
  }
}

export default async function Page() {
  // Concurrent fetching on the server
  const [upcomingMeetings, recentMeetings] = await Promise.all([
    fetchUpcomingMeetings(),
    fetchRecentMeetings()
  ]);

  return (
    <DashboardClient 
      upcomingMeetings={upcomingMeetings} 
      recentMeetings={recentMeetings} 
    />
  );
}
export const metadata = {
  title: 'Zoom - Dashboard',
  description: 'Manage and sync your Zoom clone meetings, upcoming calls, and histories.',
};
