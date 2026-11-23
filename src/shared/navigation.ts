// @trace DD-reminder-001

export type NavigationKind = "completed" | "history" | "fragment";
export type NavigationDecision = "evaluate" | "ignore" | "unknown";

export function getNavigationDecision(
  kind: NavigationKind,
  previousUrl: string | null,
  currentUrl: string,
): NavigationDecision {
  if (kind === "completed") return "evaluate";
  if (previousUrl === null) return "unknown";
  return previousUrl === currentUrl ? "ignore" : "evaluate";
}
