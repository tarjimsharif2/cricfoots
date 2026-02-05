import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format cricket overs - converts .6 to next full over
 * e.g., 19.6 -> 20, 3.6 -> 4, 19.3 -> 19.3
 */
export function formatOvers(overs: string | number | null | undefined): string | null {
  if (overs === null || overs === undefined || overs === '') return null;
  
  const oversNum = typeof overs === 'string' ? parseFloat(overs) : overs;
  if (isNaN(oversNum)) return null;
  
  const fullOvers = Math.floor(oversNum);
  const balls = Math.round((oversNum - fullOvers) * 10);
  
  // If 6 balls, it's a complete over - increment to next
  if (balls >= 6) {
    return String(fullOvers + 1);
  }
  
  // If no balls (whole number), return as integer
  if (balls === 0) {
    return String(fullOvers);
  }
  
  // Otherwise return as-is with proper format
  return `${fullOvers}.${balls}`;
}
