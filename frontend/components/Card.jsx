import React from 'react';

export default function Card({ children, className = '', onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-[#1A1A1E] rounded-2xl shadow-sm border border-gray-100 dark:border-[#232328] p-5 transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.01]' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
