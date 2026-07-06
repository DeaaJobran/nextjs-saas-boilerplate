export type SortDirection = "asc" | "desc";

export type PaginationInput = {
  defaultLimit?: number;
  maxLimit?: number;
  page?: number;
  pageSize?: number;
};

export type PaginationClause = {
  limit: number;
  offset: number;
};

export type SqlFragment = {
  params: unknown[];
  sql: string;
};

export function createPagination({
  defaultLimit = 20,
  maxLimit = 100,
  page = 1,
  pageSize,
}: PaginationInput = {}): PaginationClause {
  const limit = Math.min(
    Math.max(
      Number.isFinite(pageSize ?? defaultLimit)
        ? (pageSize ?? defaultLimit)
        : defaultLimit,
      1,
    ),
    maxLimit,
  );
  const safePage = Math.max(Number.isFinite(page) ? page : 1, 1);

  return {
    limit,
    offset: (safePage - 1) * limit,
  };
}

export function createPaginationFragment(input?: PaginationInput): SqlFragment {
  const pagination = createPagination(input);

  return {
    params: [pagination.limit, pagination.offset],
    sql: "LIMIT $1 OFFSET $2",
  };
}

export function createSortFragment({
  allowedColumns,
  defaultColumn,
  defaultDirection = "asc",
  direction,
  sortBy,
}: {
  allowedColumns: Record<string, string>;
  defaultColumn: string;
  defaultDirection?: SortDirection;
  direction?: string;
  sortBy?: string;
}): SqlFragment {
  const column = sortBy ? allowedColumns[sortBy] : undefined;
  const safeColumn = column ?? allowedColumns[defaultColumn];
  const safeDirection: SortDirection =
    direction === "desc" ? "desc" : defaultDirection;

  if (!safeColumn) {
    throw new Error(`Unknown default sort column: ${defaultColumn}`);
  }

  return {
    params: [],
    sql: `ORDER BY ${safeColumn} ${safeDirection.toUpperCase()}`,
  };
}

export function createEqualityFilterFragment(
  filters: Record<string, unknown>,
  allowedColumns: Record<string, string>,
): SqlFragment {
  const params: unknown[] = [];
  const clauses: string[] = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    const column = allowedColumns[key];

    if (!column) {
      continue;
    }

    params.push(value);
    clauses.push(`${column} = $${params.length}`);
  }

  return {
    params,
    sql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
  };
}

export function createSearchFragment({
  columns,
  query,
}: {
  columns: string[];
  query?: string;
}): SqlFragment {
  const normalizedQuery = query?.trim();

  if (!normalizedQuery || columns.length === 0) {
    return { params: [], sql: "" };
  }

  return {
    params: [`%${normalizedQuery}%`],
    sql: `(${columns.map((column) => `${column} ILIKE $1`).join(" OR ")})`,
  };
}

export function combineWhereFragments(
  ...fragments: SqlFragment[]
): SqlFragment {
  const params: unknown[] = [];
  const clauses: string[] = [];

  for (const fragment of fragments) {
    const clause = fragment.sql.replace(/^WHERE\s+/i, "").trim();

    if (!clause) {
      continue;
    }

    const offsetClause = clause.replace(/\$(\d+)/g, (_match, index) => {
      return `$${Number(index) + params.length}`;
    });

    clauses.push(offsetClause);
    params.push(...fragment.params);
  }

  return {
    params,
    sql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
  };
}
