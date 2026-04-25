# USER 액션 필요 리스트 — scoping-assistant v2 머지·배포

**작성일**: 2026-04-24
**전제**: Claude FULL-AUTO 가 Phase 1–8 구현·검증·문서화 완료 (`docs/reports/2026-04-23-scoping-assistant-mvp-completion.md`). 아래는 USER 만 실행 가능한 단계.

> 근거:
> - **CLAUDE.md §9.5**: `/ship` 은 PR 생성까지만, 자동 배포 금지.
> - **메모리 `feedback_push_authorization.md`**: main 브랜치 push 는 USER 전용.
> - **메모리 `feedback_secrets_output.md`**: secret 값은 채팅에 출력 금지.
> - **CLAUDE.md §9.4**: `/design-review` 는 로컬/스테이징 URL 대상 수동 실행 (운영 URL 금지).

---

## 체크리스트

### 1. (선택) 추가 검증 실행

로컬에서 한 번 더 green 확인하고 싶다면:

```bash
cd C:/0_project/eia-workbench
git status  # feature/scoping-assistant 브랜치, working tree clean 인지 확인
npm run typecheck
npm run lint
npm test
npm run verify:rule-pack-audit
npm run build
E2E_APP_PASSWORD='change-me-long-random' npm run test:e2e
```

**기대**: 모두 green. Claude 가 2026-04-24 10:22–10:23 에 실행한 결과:

- typecheck: 0 errors
- lint: clean
- test: 193/193
- verify:rule-pack-audit: 1/1 PASS
- build: Complete
- test:e2e: 12/12 (2연속 23s)

### 2. `/design-review` 수동 실행 (권장)

대화형 브라우저 세션이 필요해 FULL-AUTO 에서 생략. 머지 전에 한 번 돌려 UI 슬롭 확인.

```bash
# 별도 터미널에서 dev 서버 기동
cd C:/0_project/eia-workbench
npm run dev                                  # http://localhost:3000

# 프로젝트 하나 생성 후 ID 확인
# 브라우저에서 http://localhost:3000 로그인 → "새 프로젝트" → 생성 완료 시 URL /projects/<ID>
# "스코핑" 탭 클릭

# Claude Code 에서
/design-review http://localhost:3000/projects/<ID>/scoping
```

**가드**: 자동 수정 10건 이하 (CLAUDE.md §9.2). 10건 초과하면 수동 승인으로 전환.

### 3. PR 생성

```bash
cd C:/0_project/eia-workbench
git push origin feature/scoping-assistant

gh pr create --title "feat(scoping): assistant v2 — 5 rule pack (onshore_wind) + audit trip-wire + E2E" \
  --body "$(cat <<'EOF'
## Summary

환경영향평가 프로젝트의 스코핑 보조 기능 v2 구현. 입지·용도지역·면적 기반 **5 rule pack** (onshore_wind) + 법령 원문 대조 PASS (T1 재감사 2026-04-23) + 감사 친화 UI (섹션 분리 + accordion) + Claude 수동 분석 프롬프트 생성기.

### 주요 변경

- rule pack v2 `data/rules/scoping/onshore_wind.v2.yaml` (5 rules, `rule_pack_audit` 메타)
- 순수 함수 engine + self-DSL 확장 (`one_of` / `gte_by_zone`)
- `/projects/[id]/scoping` SSR + 4 API 엔드포인트 + 4 React island
- Zod `scopingInputSchema` + `StandardAnalysisResult` 표준 스키마 (`needsHumanReview: true` 리터럴)
- `workers/cron-cleanup.ts` 에 `scoping_runs` 30일 하드삭제 (CEILING=1000 가드)
- `scripts/verify-rule-pack-audit.mjs` + CI step (issue #13 trip-wire)
- DESIGN.md §2.1 scoping 배지 5종 WCAG AA 토큰
- E2E 5 specs + axe-smoke scoping 경로 추가 + crud-happy hydration-safe 재작성

### 검증 (로컬)

- typecheck 0 / lint 0 / test 193/193 / verify:rule-pack-audit PASS / build 495ms
- test:e2e 12/12 (2연속 안정, 23s)
- axe-smoke 4 경로 moderate+ 위반 0건

### CLAUDE.md §9.3 도메인 리뷰

6/6 PASS — 상세: `docs/reviews/feature-scoping-assistant-v2.md` §B.

## Test plan

- [ ] CI verify chain green (typecheck/lint/test/e2e/verify:rule-pack-audit/build)
- [ ] `/design-review http://localhost:3000/projects/<id>/scoping` (로컬, 자동 수정 10건 한도)
- [ ] 리뷰 노트 `docs/reviews/feature-scoping-assistant-v2.md` 확인
- [ ] 최종 리포트 `docs/reports/2026-04-23-scoping-assistant-mvp-completion.md` 확인
- [ ] Merge 후 프로덕션 D1 `migrations/0002_scoping.sql` 적용 (`wrangler d1 migrations apply DB --remote`)
- [ ] 프로덕션 스모크 — 프로젝트 생성 → `/scoping` → 5 rules 1 run 실행 → history 1건 확인

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### 4. CI verify chain 확인

PR 생성 직후 GitHub Actions 에서 `verify` workflow 가 돌면서 (typecheck/lint/test/test:e2e/verify-rule-pack-audit/build) 모두 green 되어야 함. red 발생 시 즉시 중단하고 Claude 에 로그 전달.

### 5. 머지

```bash
# PR 페이지에서 "Merge pull request" 클릭 (squash 권장)
# 또는
gh pr merge <PR#> --squash
```

### 6. 머지 후 프로덕션 D1 migration 적용

```bash
# wrangler.toml 의 database_id 가 프로덕션 D1 맞는지 확인
cd C:/0_project/eia-workbench
git checkout main && git pull

# 마이그레이션 상태 확인
wrangler d1 migrations list DB --remote
# 기대: 0002_scoping 이 "To Apply" 목록에 있음

# 적용
wrangler d1 migrations apply DB --remote
# 기대: ✅ 0002_scoping.sql applied

# 검증 — 테이블 생성 확인
wrangler d1 execute DB --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name='scoping_runs';"
# 기대: scoping_runs 1행
```

### 7. 프로덕션 스모크

```
https://eia-workbench-v0.pages.dev 로그인
→ "새 프로젝트" → 임의 이름 → 시도 (강원도/평창) 입력 → 만들기
→ 스코핑 탭 클릭
→ 입력:
   사업부지 면적 8000 (단위 ㎡)
   용도지역 "농림지역 (농림)"
   산지전용 면적 (선택) 800
→ "검토 실행" 클릭
→ 기대 결과:
   - 발동 섹션 2카드:
     * 소규모 환경영향평가 — 농림/자연환경보전/생산관리 3존 번들
     * 산지전용허가 — 660㎡ 이상 타당성조사 대상
   - 스킵 섹션 3 (accordion 기본 접힘):
     * 환경영향평가 대상 여부 — 발전시설용량 100 MW
     * 소규모 환경영향평가 — 보전관리지역 5,000㎡
     * 소규모 환경영향평가 — 계획관리지역 10,000㎡
   - 상단 고정 배너: "내부 검토용 초안…"
   - rule pack 버전: onshore_wind/v2.2026-04-23
→ "Claude 분석 프롬프트 복사" 클릭 → 임의 에디터에 붙여넣어 7개 섹션 존재 확인
→ 좌측 history 에 실행 1건 등록 확인
→ 프로젝트 목록 → 생성한 프로젝트 "삭제"
→ "최근 삭제" 드로어 → "되돌리기"
→ 복구됨 토스트
```

실패 시:

- scoping 탭 클릭 시 404 → D1 migration 미적용 (Step 6 재실행).
- rule pack 버전 미표시 → `scripts/verify-rule-pack-audit.mjs` 는 local 에서만 도는 build-time gate. 프로덕션 번들에 YAML 이 포함됐는지 확인 (`wrangler pages deployment tail` 로 로그 확인).
- 배지 색 틀어짐 → CSS fix 재발생 (`scripts/check-build-css.sh` 돌려서 확인).

### 8. 결과 공유

- 스모크 결과 (OK / 문제 목록) 를 Claude 에게 전달하면 아래 작업 중 선택 가능:
  - housekeeping 이슈 처리 (#40 kostat / #41 route hardening)
  - follow-up 이슈 작성 (§F 09–13)
  - 다음 feature office hours (`feature/draft-checker` 등)

---

## 주의사항 (재확인)

- **머지·push 는 USER 만**. Claude 는 commit 까지.
- **secret 값 채팅 금지**. `.dev.vars` / `wrangler pages secret put` 의 value 는 로컬 파일로만.
- **운영 URL 에 `/design-review` 금지**. 로컬 또는 스테이징만.
- **자동 배포 금지**. `wrangler pages deploy` 는 USER 가 명시적으로 실행 (CLAUDE.md §9.5).
- **법령 숫자 수정 시 재감사 BLOCKING**. `data/rules/scoping/*.yaml` 수정 PR 은 `docs/findings/` 에 재감사 리포트 + `rule_pack_audit.audit_verdict=PASS` 갱신 없이 CI 가 막음 (issue #13).
