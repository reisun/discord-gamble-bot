---
name: manage-task
description: TASK.md を読み、対象タスクに必要な工程を決めて適切な skill に振り分ける
context: fork
agent: Explore
---

対象: $ARGUMENTS

手順:
1. TASK.md から対象タスクを特定する
2. 目的、制約、完了条件を整理する
3. 次のどの工程が必要か判断し、必要なら subagents を使って並列に作業させる
   - investigate
   - implement-fix
   - review-change
   - update-design-doc
4. 必要な順序を決める
5. 各工程の実施内容を短くまとめる
6. 作業後、TASK.md に反映すべき更新案を示す

出力:
- 対象タスク
- 目的
- 必要工程
- 実行順
- 完了条件
- TASK.md 更新案