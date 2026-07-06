import * as React from "react";

import { cn } from "../lib/utils";

export type DataTableColumn<TData> = {
  key: string;
  header: string;
  cell: (row: TData) => React.ReactNode;
  className?: string;
};

export function DataTable<TData>({
  ariaLabel,
  columns,
  data,
  empty,
  emptyLabel,
}: {
  ariaLabel?: string;
  columns: DataTableColumn<TData>[];
  data: TData[];
  empty?: React.ReactNode;
  emptyLabel?: string;
}) {
  if (data.length === 0) {
    if (empty) {
      return <>{empty}</>;
    }

    return emptyLabel ? (
      <p className="text-muted-foreground rounded-md border p-4 text-sm">
        {emptyLabel}
      </p>
    ) : null;
  }

  return (
    <div
      aria-label={ariaLabel}
      className="focus-visible:ring-ring w-full overflow-x-auto rounded-lg border focus-visible:ring-2 focus-visible:outline-none"
      role={ariaLabel ? "region" : undefined}
      tabIndex={0}
    >
      <table className="w-full min-w-[42rem] caption-bottom text-sm">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th
                className={cn(
                  "px-4 py-3 text-start font-medium",
                  column.className,
                )}
                key={column.key}
                scope="col"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr className="border-t" key={rowIndex}>
              {columns.map((column) => (
                <td
                  className={cn("px-4 py-3", column.className)}
                  key={column.key}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
