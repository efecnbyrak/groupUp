import { clsx, type ClassValue } from "clsx";

/** Sınıf birleştirici (koşullu sınıflar). Tailwind çakışma çözümü yok: varyantlar tasarım gereği çakışmaz. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
