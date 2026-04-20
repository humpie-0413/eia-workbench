# Fetch full KOSTAT administrative divisions

Replace `src/data/administrative-divisions.json` from 행정안전부 행정표준코드 공공데이터
(https://www.code.go.kr) before production. Keep the JSON shape identical:
`{ version, source, regions: [{ code, name, subs: [{ code, name }] }] }`.
Seed values ship with 3 시/도 × 2 시/군/구 for unit tests — replace with full ~250 시/군/구.
