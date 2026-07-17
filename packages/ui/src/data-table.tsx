import type { ReactNode } from 'react';

export type DataColumn<Row> = {
  header: string;
  key: string;
  render: (row: Row) => ReactNode;
};

export function DataTable<Row>({
  caption,
  columns,
  getRowKey,
  rows,
}: {
  caption: string;
  columns: readonly DataColumn<Row>[];
  getRowKey: (row: Row) => string;
  rows: readonly Row[];
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-default)]">
      <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-[var(--surface-subtle)]">
          <tr>
            {columns.map((column) => (
              <th className="border-b border-[var(--border-strong)] px-4 py-3 font-bold" key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-b border-[var(--border-default)] last:border-0" key={getRowKey(row)}>
              {columns.map((column) => (
                <td className="px-4 py-3 align-top" key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
