import type { FocusSession, PlanItem, Project, Task, TodoItem } from "@/lib/domain";

export function sortByOrder<T extends { order: number }>(items: T[]) {
  return items.slice().sort((a, b) => a.order - b.order);
}

export function sortTodoItems(items: TodoItem[]) {
  return items.slice().sort(
    (a, b) =>
      Number(a.completed) - Number(b.completed) ||
      a.urgency - b.urgency ||
      a.hours - b.hours ||
      b.createdAt.localeCompare(a.createdAt),
  );
}

export function sortSessionsNewestFirst(items: FocusSession[]) {
  return items.slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function sortSessionsOldestFirst(items: FocusSession[]) {
  return items.slice().sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

export function stripPlanDate<T extends PlanItem & { date?: string }>(item: T): PlanItem {
  const { date, ...rest } = item;
  void date;
  return rest;
}

export function getOrderedProjects(projects: Project[]) {
  return sortByOrder(projects);
}

export function getProjectLabelById(projects: Project[]) {
  return new Map(projects.map((project) => [project.id, project.title]));
}

export function getTaskLookupById(tasks: Task[]) {
  return new Map(tasks.map((task) => [task.id, { title: task.title, projectId: task.projectId }]));
}
