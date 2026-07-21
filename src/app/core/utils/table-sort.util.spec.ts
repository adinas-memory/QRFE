import { compareTableLabels, sortByTableLabel, sortTablesByName } from './table-sort.util';

describe('table-sort.util', () => {
  it('compareTableLabels sorts T-n labels numerically', () => {
    expect(compareTableLabels('T-1', 'T-2')).toBeLessThan(0);
    expect(compareTableLabels('T-2', 'T-10')).toBeLessThan(0);
    expect(compareTableLabels('T-10', 'T-2')).toBeGreaterThan(0);
  });

  it('sortTablesByName orders mixed table names naturally', () => {
    const sorted = sortTablesByName([
      { tableName: 'T-10' },
      { tableName: 'Terrace' },
      { tableName: 'T-2' },
      { tableName: 'T-1' },
      { tableName: 'Bar' },
    ]);

    expect(sorted.map((t) => t.tableName)).toEqual([
      'Bar',
      'T-1',
      'T-2',
      'T-10',
      'Terrace',
    ]);
  });

  it('sortByTableLabel supports custom label accessors', () => {
    const sorted = sortByTableLabel(
      [{ label: 'T-3' }, { label: 'T-11' }, { label: 'T-2' }],
      (item) => item.label,
    );

    expect(sorted.map((t) => t.label)).toEqual(['T-2', 'T-3', 'T-11']);
  });

  it('does not mutate the source array', () => {
    const source = [{ tableName: 'T-2' }, { tableName: 'T-1' }];
    const copy = [...source];
    sortTablesByName(source);
    expect(source).toEqual(copy);
  });
});
