# LUH Board Storm — Verified Closure List (run 2026-08-30)

Companion: \LUH-boardstorm-assessment.md\, \LUH-adapter-failure-rca.md\. Handoff issue: **LUH-257**.

## Summary (authoritative API, re-verified this run)

- Open \stale_active_run_evaluation\ alerts: **90**
- False positives (subject run terminal: succeeded/cancelled): **87**
- Genuine failures (subject run failed): **3**
- Running/other: **1**  |  Fetch errors: **1**

## 87 FALSE POSITIVES — close as done / false_positive

Subject runs are already terminal; the watchdog fired on a stale terminal state. Bulk-close via Board UI
or a checked-out sweep run (PATCH 200 proven in run 98e616ad). Do NOT close the 3 genuine below.

- LUH-47 | run d50774b1 | succeeded
- LUH-251 | run b41f17a7 | succeeded
- LUH-250 | run 1af1f1e9 | cancelled
- LUH-248 | run 8acab715 | cancelled
- LUH-246 | run 0c13a53b | cancelled
- LUH-228 | run 3620fd06 | cancelled
- LUH-233 | run c666ca82 | succeeded
- LUH-231 | run 7dbb87cc | cancelled
- LUH-232 | run 808a7f91 | cancelled
- LUH-226 | run 9c32ad5f | cancelled
- LUH-230 | run b4963665 | cancelled
- LUH-227 | run e7a7b63a | cancelled
- LUH-224 | run 29f1f439 | cancelled
- LUH-225 | run 4fb36dd4 | cancelled
- LUH-222 | run bf3dd9c6 | cancelled
- LUH-221 | run 263897d6 | cancelled
- LUH-220 | run 42eb2c7c | cancelled
- LUH-219 | run c79546ce | cancelled
- LUH-76 | run 19bca6f4 | cancelled
- LUH-98 | run 3c5edf01 | cancelled
- LUH-99 | run 93bbf00d | cancelled
- LUH-126 | run 8befb159 | cancelled
- LUH-127 | run 94179e39 | cancelled
- LUH-131 | run 36470908 | cancelled
- LUH-133 | run 5c8e68c2 | cancelled
- LUH-128 | run 13f62aea | cancelled
- LUH-129 | run cadd84d9 | cancelled
- LUH-130 | run 4e5c639e | cancelled
- LUH-135 | run a7d9aec2 | cancelled
- LUH-132 | run 08ed6141 | cancelled
- LUH-134 | run ac9b2cde | cancelled
- LUH-142 | run 40b73edd | cancelled
- LUH-144 | run 038dd75b | cancelled
- LUH-136 | run 93a32e55 | cancelled
- LUH-138 | run 3ddee8cf | cancelled
- LUH-137 | run 68e2a028 | cancelled
- LUH-141 | run 80c06b2a | cancelled
- LUH-140 | run b8d9e7b6 | cancelled
- LUH-139 | run d4f09a08 | cancelled
- LUH-143 | run ee7c6d0d | cancelled
- LUH-147 | run 2d0cb472 | cancelled
- LUH-153 | run a89d5c3d | cancelled
- LUH-155 | run 50c348be | cancelled
- LUH-159 | run 5f50b350 | cancelled
- LUH-158 | run 3c83fc0c | cancelled
- LUH-160 | run 0780dcc0 | cancelled
- LUH-163 | run a5b803e5 | cancelled
- LUH-162 | run a6872078 | cancelled
- LUH-164 | run 8573851c | cancelled
- LUH-165 | run 34ca1e0d | cancelled
- LUH-166 | run 4a1b10d6 | cancelled
- LUH-167 | run 12cd76c6 | cancelled
- LUH-170 | run a4074844 | cancelled
- LUH-171 | run bde8f9e2 | cancelled
- LUH-172 | run 6fc0fae0 | cancelled
- LUH-173 | run 7919a43c | cancelled
- LUH-174 | run 0fb8a4e4 | cancelled
- LUH-175 | run 759d987c | cancelled
- LUH-176 | run 40be5986 | cancelled
- LUH-177 | run 0c3893e9 | cancelled
- LUH-178 | run dc342638 | cancelled
- LUH-179 | run 0eb569ac | cancelled
- LUH-180 | run f131c02c | cancelled
- LUH-182 | run 2d9f7868 | cancelled
- LUH-183 | run f3e1b25c | cancelled
- LUH-184 | run 59622969 | cancelled
- LUH-186 | run 71ee6d54 | cancelled
- LUH-187 | run 9dffbbba | cancelled
- LUH-188 | run 8002ed98 | cancelled
- LUH-189 | run 0427a4d7 | cancelled
- LUH-192 | run edd3506e | cancelled
- LUH-193 | run 4273e9e8 | cancelled
- LUH-194 | run 60b147b4 | cancelled
- LUH-195 | run acaa4185 | cancelled
- LUH-196 | run f2fc5685 | cancelled
- LUH-197 | run 7b880465 | cancelled
- LUH-198 | run 0f70ddfd | cancelled
- LUH-199 | run f26f56b8 | cancelled
- LUH-200 | run 57cec862 | cancelled
- LUH-201 | run 3964527b | cancelled
- LUH-202 | run 8aa50b50 | cancelled
- LUH-203 | run eb896b49 | cancelled
- LUH-204 | run 8f4b2125 | cancelled
- LUH-205 | run 1862cfbc | cancelled
- LUH-206 | run d76f282f | cancelled
- LUH-207 | run 581c3249 | cancelled
- LUH-78 | run 3a9b2767 | cancelled

## 3 GENUINE FAILURES — route to existing owners (do NOT close)

- LUH-145 | run bcddf199 | adapter_failed: Failed to execute statement
- LUH-48 | run 37989026 | adapter_failed: Unexpected server error. Check server logs for details.
- LUH-190 | run 0c0db503 | adapter_failed: Failed to execute statement

  - LUH-145 & LUH-190: runtime-Postgres terminal result-write failure → **LUH-210 / LUH-238**.
  - LUH-48: provider/server 5xx (\ef: err_62914a2d\) → **LUH-154**.

## Watchdog fix

\stale_active_run_evaluation\ must ignore terminal-state runs → **LUH-256**.

