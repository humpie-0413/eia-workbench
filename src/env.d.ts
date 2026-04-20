/// <reference types="astro/client" />

import type { Runtime as CfRuntime } from '@astrojs/cloudflare';

declare global {
  interface Env {
    DB: D1Database;
    UPLOADS: R2Bucket;
    APP_PASSWORD: string;
    JWT_SECRET: string;
    TURNSTILE_SECRET_KEY: string;
    TURNSTILE_SITE_KEY: string;
    APP_ORIGIN: string;
  }

  namespace App {
    interface Locals extends CfRuntime<Env> {
      session?: { jti: string };
    }
  }
}
