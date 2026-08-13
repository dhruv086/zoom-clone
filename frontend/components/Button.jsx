import React from 'react';

export default function Button({ children, onClick, variant = 'primary', className = '', type = 'button', ...props }) {
  const baseStyles = 'px-4 py-2 rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-[#0E71EB] hover:bg-[#0C63CE] text-white shadow-sm',
    secondary: 'bg-[#E3E3E3] hover:bg-[#D4D4D4] text-[#242424] dark:bg-[#232328] dark:hover:bg-[#2E2E34] dark:text-white',
    danger: 'bg-[#E02424] hover:bg-[#C81E1E] text-white shadow-sm',
    orange: 'bg-[#E05F19] hover:bg-[#C95112] text-white shadow-sm', // Zoom "New Meeting" orange
    outline: 'border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-[#232328] text-gray-700 dark:text-gray-200',
    ghost: 'hover:bg-gray-100 dark:hover:bg-[#232328] text-gray-700 dark:text-gray-200'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
