import { newR2Suffix } from '@/lib/id';

export function buildR2Key(projectId: string): string {
  return `projects/${projectId}/${newR2Suffix()}`;
}
