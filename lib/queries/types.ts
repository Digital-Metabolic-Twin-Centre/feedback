export type SelectContext = {
  schema: string;
  tableName: string;
  filters: Record<string, string>;
  groups: string[];
  dateFilter?: { field: string; from?: string; to?: string };
};

export type SelectQueryResult = {
  sql: string;
  params: unknown[];
};

export type SelectQueryBuilder = {
  select: (args: {
    schema: string;
    tableName: string;
    filters: Record<string, string>;
    groups: string[];
    dateFilter?: { field: string; from?: string; to?: string };
  }) => {
    sql: string;
    params: unknown[];
  };

  count?: (args: {
    schema: string;
    tableName?: string;
    filters: Record<string, string>;
    groups: string[];
    dateFilter?: { field: string; from?: string; to?: string };
  }) => {
    sql: string;
    params: unknown[];
  };
};
