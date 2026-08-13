'use client';

import React, { useState, useEffect } from 'react';

export default function Clock() {
  const [time, setTime] = useState(null);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!time) {
    // SSR safe placeholder loading state
    return (
      <div className="text-white min-h-[80px]">
        <div className="h-10 w-32 bg-white/20 rounded animate-pulse"></div>
        <div className="h-4 w-48 bg-white/20 rounded animate-pulse mt-2"></div>
      </div>
    );
  }

  const formattedTime = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  const formattedDate = time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // Separate time number and meridiem (AM/PM) to render like standard clocks
  const parts = formattedTime.split(' ');
  const timeStr = parts[0];
  const meridiem = parts[1] || '';

  return (
    <div className="text-white drop-shadow-md">
      <h1 className="text-5xl font-light tracking-tight md:text-6xl select-none">
        {timeStr} <span className="text-xl md:text-2xl font-normal uppercase">{meridiem}</span>
      </h1>
      <p className="text-sm md:text-base font-medium text-blue-100 mt-2 select-none">
        {formattedDate}
      </p>
    </div>
  );
}
