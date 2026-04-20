/// <reference types="astro/client" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

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
