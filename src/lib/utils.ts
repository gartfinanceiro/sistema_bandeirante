/**
 * Formats a date string (YYYY-MM-DD) to Brazilian format (DD/MM/YYYY).
 * Used for database DATE fields to avoid timezone issues.
 * 
 * @param dateStr Date string in YYYY-MM-DD format
 * @returns Formatted date string (DD/MM/YYYY) or "-" if invalid
 */
export function formatDateBR(dateStr: string | null | undefined): string {
    if (!dateStr) return "-";

    // Ensure we are working with just the date part if it happens to be a full ISO string
    const cleanDate = dateStr.split("T")[0];
    const parts = cleanDate.split("-");

    if (parts.length !== 3) return dateStr;

    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
}
