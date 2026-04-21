import type { APIRoute } from 'astro';
import { uploadMetaSchema } from '@/lib/schemas';
import { MAX_FILE_BYTES, MAX_PROJECT_BYTES, MAX_PROJECT_FILES } from '@/lib/constants';
import { validateMagicBytes } from '@/lib/upload/magic-bytes';
import { buildR2Key } from '@/lib/upload/r2-key';
import { newUploadId } from '@/lib/id';
import { logger } from '@/lib/logger';

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const POST: APIRoute = async ({ params, request, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';

  const projectId = params.id;
  if (projectId === undefined) return new Response('bad request', { status: 400 });

  const project = await env.DB.prepare(
    `SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL`
  )
    .bind(projectId)
    .first<{ id: string }>();
  if (!project) return new Response('project not found', { status: 404 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response('invalid form', { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) return new Response('missing file', { status: 400 });

  if (file.size > MAX_FILE_BYTES) return new Response('file too large', { status: 413 });

  const meta = uploadMetaSchema.safeParse({
    original_name: file.name ?? 'unnamed',
    mime: file.type,
    size_bytes: file.size
  });
  if (!meta.success) return new Response('unsupported media type', { status: 415 });

  const quota = await env.DB.prepare(
    `SELECT COALESCE(SUM(size_bytes), 0) AS total, COUNT(*) AS n FROM uploads
     WHERE project_id = ? AND deleted_at IS NULL`
  )
    .bind(projectId)
    .first<{ total: number; n: number }>();
  const total = quota?.total ?? 0;
  const n = quota?.n ?? 0;
  if (n >= MAX_PROJECT_FILES) return new Response('project file-count exceeded', { status: 413 });
  if (total + file.size > MAX_PROJECT_BYTES)
    return new Response('project quota exceeded', { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ok = await validateMagicBytes(bytes, meta.data.mime);
  if (!ok) return new Response('content does not match mime', { status: 415 });

  const sha = await sha256Hex(bytes.buffer as ArrayBuffer);
  const dup = await env.DB.prepare(
    `SELECT id, original_name, created_at FROM uploads WHERE project_id = ? AND sha256 = ? AND deleted_at IS NULL`
  )
    .bind(projectId, sha)
    .first<{ id: string; original_name: string; created_at: string }>();
  if (dup) {
    logger.info({
      route: '/api/projects/[id]/uploads',
      method: 'POST',
      status: 409,
      latencyMs: Date.now() - t0,
      jti
    });
    return Response.json(
      { error: 'duplicate', original_name: dup.original_name, created_at: dup.created_at },
      { status: 409 }
    );
  }

  const id = newUploadId();
  const key = buildR2Key(projectId);
  let r2Uploaded = false;
  try {
    await env.UPLOADS.put(key, bytes.buffer as ArrayBuffer);
    r2Uploaded = true;
    await env.DB.prepare(
      `INSERT INTO uploads (id, project_id, r2_key, sha256, original_name, mime, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, projectId, key, sha, meta.data.original_name, meta.data.mime, meta.data.size_bytes)
      .run();
  } catch (err) {
    if (r2Uploaded) {
      await env.UPLOADS.delete(key).catch(() => {});
    }
    logger.error({
      route: '/api/projects/[id]/uploads',
      method: 'POST',
      status: 500,
      latencyMs: Date.now() - t0,
      jti,
      error: err instanceof Error ? err : new Error(String(err))
    });
    return new Response('internal', { status: 500 });
  }

  logger.info({
    route: '/api/projects/[id]/uploads',
    method: 'POST',
    status: 201,
    latencyMs: Date.now() - t0,
    jti
  });
  return Response.json({ id, sha256: sha }, { status: 201 });
};

export const GET: APIRoute = async ({ params, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';

  const projectId = params.id;
  if (projectId === undefined) return new Response('bad request', { status: 400 });

  const project = await env.DB.prepare(
    `SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL`
  )
    .bind(projectId)
    .first<{ id: string }>();
  if (!project) {
    logger.info({
      route: '/api/projects/[id]/uploads',
      method: 'GET',
      status: 404,
      latencyMs: Date.now() - t0,
      jti
    });
    return new Response('project not found', { status: 404 });
  }

  const { results } = await env.DB.prepare(
    `SELECT id, original_name, mime, size_bytes, created_at FROM uploads
     WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`
  )
    .bind(projectId)
    .all();
  logger.info({
    route: '/api/projects/[id]/uploads',
    method: 'GET',
    status: 200,
    latencyMs: Date.now() - t0,
    jti
  });
  return Response.json({ uploads: results });
};
