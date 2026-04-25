// scripts/cases-bootstrap.ts
//
// similar-cases 인덱서 부트스트랩 가이드 스크립트 (1회 수동 실행).
//
// 이 스크립트는 직접 SERVICE_KEY 를 호출하지 않는다. data.go.kr 호출은
// `workers/cases-indexer.ts` 에서만 일어나야 하며, 부트스트랩은 wrangler
// dev/trigger 를 통해 워커 컨텍스트 안에서 실행한다 (CLAUDE.md §2-2 가드).
//
// 사용 (로컬):
//   1) wrangler d1 migrations apply DB --local
//   2) wrangler dev workers/cases-indexer.ts --local --test-scheduled \
//        --config workers/cases-indexer.wrangler.toml
//   3) (별도 터미널) curl "http://localhost:8787/__scheduled?cron=0+18+*+*+0"
//   4) wrangler d1 execute DB --local --command "SELECT * FROM eia_cases_sync ORDER BY id DESC LIMIT 1;"
//
// 사용 (운영):
//   1) wrangler d1 migrations apply DB --remote
//   2) wrangler trigger cases-indexer --config workers/cases-indexer.wrangler.toml
//   3) wrangler d1 execute DB --remote --command "SELECT COUNT(*) FROM eia_cases;"

const ENV_FLAG = process.argv.find((a) => a.startsWith('--env=')) ?? '--env=local';
const env = ENV_FLAG.replace('--env=', '');

const SCOPE: Record<string, { d1Flag: string; trigger: string }> = {
  local: {
    d1Flag: '--local',
    trigger: 'wrangler dev workers/cases-indexer.ts --local --test-scheduled --config workers/cases-indexer.wrangler.toml'
  },
  production: {
    d1Flag: '--remote',
    trigger: 'wrangler trigger cases-indexer --config workers/cases-indexer.wrangler.toml'
  }
};

const scope = SCOPE[env];
if (!scope) {
  console.error(`Unknown env: ${env}. Use --env=local or --env=production.`);
  process.exit(1);
}

console.log('=== similar-cases 부트스트랩 가이드 ===');
console.log(`환경: ${env}`);
console.log('');
console.log('1) 마이그레이션 적용:');
console.log(`   wrangler d1 migrations apply DB ${scope.d1Flag}`);
console.log('');
console.log('2) 인덱서 트리거:');
console.log(`   ${scope.trigger}`);
if (env === 'local') {
  console.log('   (별도 터미널) curl "http://localhost:8787/__scheduled?cron=0+18+*+*+0"');
}
console.log('');
console.log('3) 결과 검증:');
console.log(
  `   wrangler d1 execute DB ${scope.d1Flag} --command "SELECT COUNT(*) AS n FROM eia_cases;"`
);
console.log(
  `   wrangler d1 execute DB ${scope.d1Flag} --command "SELECT * FROM eia_cases_sync ORDER BY id DESC LIMIT 1;"`
);
console.log('');
console.log('주의: SERVICE_KEY 는 .dev.vars (local) 또는 wrangler pages secret (production) 에만 둡니다.');
console.log('     이 스크립트는 직접 외부 API 를 호출하지 않습니다.');
