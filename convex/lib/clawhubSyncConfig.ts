export const CLAWHUB_CONVEX_QUERY_URL =
  'https://wry-manatee-359.convex.cloud/api/query';

// One catalog fetch should cover enough entries to make fast-skip effective
// without creating unnecessary upstream request churn.
export const DEFAULT_CLAWHUB_PAGE_SIZE = 100;
export const MIN_CLAWHUB_PAGE_SIZE = 10;
export const MAX_CLAWHUB_PAGE_SIZE = 100;

// Heavy imports still decode archives and publish versions, so keep the
// per-action import count small even when the fetched catalog page is larger.
export const MAX_IMPORT_BATCH_ITEMS = 4;

export const FETCH_TIMEOUT_MS = 60_000;
