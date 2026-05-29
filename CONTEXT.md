# CONTEXT.md — CEQTSimple

## Domain Glossary

### Workspace (工作区)
A named context that isolates one person's tasks. Entering a workspace name (e.g., "张三") loads that person's task data from localStorage. No authentication — any name creates or accesses a workspace. Replaces the misleading "Login" concept from the previous version.

### Eisenhower Matrix (四象限矩阵)
A 2D grid mapping tasks by Importance (vertical axis, 1–7) and Urgency (horizontal axis, 0–12). The center is at importance=4, urgency=6. Tasks positioned top-left are "not urgent, not important" (Q3); top-right are "urgent, not important" (Q4); bottom-left are "not urgent, important" (Q1); bottom-right are "urgent, important" (Q2).

### Task (任务)
A unit of work with a position on the matrix, a category, optional subtasks, notes, and an optional reminder time. Tasks can be completed (moves off the matrix), edited, or deleted.

### Subtask (子任务)
A checklist item within a task. Has text, done status, and an order for display sequence. The parent task's progress is shown as a ring around its dot on the matrix.

### Category (分类)
Predefined buckets for organizing tasks: work (工作), personal (个人), study (学习), health (健康), family (家庭), other (其他).

### Importance (重要程度)
How critical a task is, rated 1–7. 7 is highest importance. Determines vertical position on the matrix and dot color (cool blue → warm red).

### Urgency (紧急程度)
How soon a task needs attention, rated 0–12. Maps to human-readable timeframes: 0=1年, 1=半年, 2=3个月, 3=1个月, 4=1周, 5=3天, 6=1天, 7=10小时, 8=4小时, 9=2小时, 10=1小时, 11=30分钟, 12=15分钟. Determines horizontal position and dot opacity.

### Reminder (提醒)
An optional timestamp on a task. When the current time passes the reminder time, a browser notification fires. Best-effort in background tabs due to browser throttling.
