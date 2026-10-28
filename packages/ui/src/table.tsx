import type { HTMLAttributes, ReactNode, ThHTMLAttributes } from 'react';

import { cn } from './cn';

export interface TableColumn {
  key: string;
  header: string;
  numeric?: boolean;
  className?: string;
}

export interface TableProps {
  caption: string;
  columns: TableColumn[];
  rows: Array<Record<string, ReactNode>>;
  empty?: ReactNode;
  className?: string;
}

/** Tableau accessible : légende, en-têtes de colonnes, défilement horizontal maîtrisé. */
export function Table({ caption, columns, rows, empty, className }: TableProps) {
  return (
    <div className={cn('overflow-x-auto rounded-panel border border-line bg-surface', className)}>
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line">
            {columns.map((column) => (
              <Th key={column.key} numeric={column.numeric} className={column.className}>
                {column.header}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-muted">
                {empty ?? 'Aucune donnée.'}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={typeof row['id'] === 'string' ? row['id'] : index}
                className="border-b border-line last:border-0"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 py-3 align-middle text-ink',
                      column.numeric && 'font-mono tabular-nums',
                      column.className,
                    )}
                  >
                    {row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  numeric,
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean | undefined }) {
  return (
    <th
      scope="col"
      className={cn(
        'px-4 py-2.5 text-xs font-bold uppercase tracking-[.04em] text-muted',
        numeric && 'text-right',
        className,
      )}
      {...props}
    />
  );
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Carte de contenu, rayon par univers. */
export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('rounded-panel border border-line bg-surface p-3.5', className)}
      {...props}
    />
  );
}
