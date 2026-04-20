export const MAX_FILE_BYTES = 30 * 1024 * 1024;
export const MAX_PROJECT_BYTES = 300 * 1024 * 1024;
export const MAX_PROJECT_FILES = 30;

export const ALLOWED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];

export const SOFT_DELETE_RETENTION_DAYS = 30;
export const CRON_HARD_DELETE_ROW_CEILING = 1000;

export const LOGIN_FAIL_WINDOW_MINUTES = 10;
export const LOGIN_FAIL_MAX = 5;
export const LOGIN_MIN_RESPONSE_MS = 300;

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
