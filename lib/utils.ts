import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(val: any, options?: Intl.DateTimeFormatOptions): string {
  if (!val) return "";
  try {
    let date: Date;
    if (typeof val?.toDate === "function") {
      date = val.toDate();
    } else if (val instanceof Date) {
      date = val;
    } else if (typeof val === "number" || typeof val === "string") {
      date = new Date(val);
    } else if (val?.seconds) {
      date = new Date(val.seconds * 1000);
    } else {
      return "";
    }
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, options || { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function formatDateTime(val: any): string {
  if (!val) return "";
  try {
    let date: Date;
    if (typeof val?.toDate === "function") {
      date = val.toDate();
    } else if (val instanceof Date) {
      date = val;
    } else if (typeof val === "number" || typeof val === "string") {
      date = new Date(val);
    } else if (val?.seconds) {
      date = new Date(val.seconds * 1000);
    } else {
      return "";
    }
    if (isNaN(date.getTime())) return "";
    return date.toLocaleString();
  } catch {
    return "";
  }
}

/** Parse an HTML date input (YYYY-MM-DD) as local calendar day, not UTC midnight. */
export function parseDateInputLocal(dateStr: string, endOfDay = true): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) {
    return new Date(NaN);
  }
  if (endOfDay) {
    return new Date(year, month - 1, day, 23, 59, 59, 999);
  }
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

