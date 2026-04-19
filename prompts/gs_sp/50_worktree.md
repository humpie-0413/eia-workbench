plan이 승인됐다. 이제 Superpowers 의 using-git-worktrees 스킬이 자동으로 워크트리를 생성할 것이다.
그대로 두되, 아래를 확인하라.

확인 항목:
1. 워크트리 경로는 ../eia-workbench-{feature_name} 형식. 부모 디렉터리에 만들어지는 게 맞음.
2. 브랜치는 feature/{feature_name}. main이 아니어야 함.
3. 생성 직후 깨끗한 테스트 베이스라인을 확인했는지 (npm ci && npm test).
4. .env, data/samples/private/ 는 워크트리에도 gitignore/.claudeignore로 제외돼 있는지.

문제 없으면 현재 셸을 워크트리 디렉터리로 cd 하라.
문제가 있으면 내 승인 없이 진행하지 말고 질문하라.
