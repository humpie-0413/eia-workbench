// Rule pack inline import — YAML 내용을 번들에 포함 (Cloudflare Workers 런타임에 파일시스템 없음)
// `?raw` Vite/Astro feature: YAML 파일을 string literal 로 import
// Ref: data/rules/scoping/onshore_wind.v2.yaml (소스 파일, CI verify-rule-pack-audit 에서 감사)
import yamlText from '../../../data/rules/scoping/onshore_wind.v2.yaml?raw';
import { loadRulePackFromString, validateAudit, type RulePack } from './rule-pack-loader';

let cached: RulePack | null = null;

export function getOnshoreWindRulePack(): RulePack {
  if (cached) return cached;
  const pack = loadRulePackFromString(yamlText);
  validateAudit(pack);
  cached = pack;
  return pack;
}
