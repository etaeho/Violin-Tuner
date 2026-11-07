// 가장 먼저 실행 (main.tsx 첫 import) — 저장소(store)가 값을 읽기 전에 v1 값을 옮겨 둠
import { migrateFromV1 } from './data/migrateV1';
try { migrateFromV1(localStorage); } catch { /* 저장소 접근 불가 시 무시 */ }
