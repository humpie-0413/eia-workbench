/// <reference types="astro/client" />

import type { Runtime as CfRuntime } from '@astrojs/cloudflare';
type Runtime = CfRuntime<Env>;

interface Env {
  DB: D1Database;
  UPLOADS: R2Bucket;
  APP_PASSWORD: string;
  JWT_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  TURNSTILE_SITE_KEY: string;
  APP_ORIGIN: string;
}

declare namespace App {
  interface Locals extends Runtime {
    session?: { jti: string };
  }
}
