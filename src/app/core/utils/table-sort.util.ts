/** Natural ascending sort for table labels (T-1, T-2, T-10) and plain alphabetic names. */
export function compareTableLabels(
  a: string | null | undefined,
  b: string | null | undefined,
  locale?: string,
): number {
  return (a ?? '').localeCompare(b ?? '', locale, { numeric: true, sensitivity: 'base' });
}

export function sortByTableLabel<T>(
  items: readonly T[],
  getLabel: (item: T) => string | null | undefined,
  locale?: string,
): T[] {
  return items.slice().sort((left, right) =>
    compareTableLabels(getLabel(left), getLabel(right), locale),
  );
}

export function sortTablesByName<T extends { tableName?: string | null }>(
  tables: readonly T[],
  locale?: string,
): T[] {
  return sortByTableLabel(tables, (table) => table.tableName, locale);
}
