"use client";

import { SelectHTMLAttributes, ReactNode } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode;
  className?: string;
}

export default function Select({ children, className = "", ...props }: SelectProps) {
  return (
    <select
      className={`w-full rounded-lg bg-gray-50 border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
