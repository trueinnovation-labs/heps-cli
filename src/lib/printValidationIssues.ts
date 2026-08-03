import type { HepsValidationIssue } from "../sdk/index.js";

/** Groups issues by file path (sorted), then by code within each path. Shared by heps check and heps build. */
export function printGroupedIssues(issues: readonly HepsValidationIssue[]): void {
  const byPath = new Map<string, HepsValidationIssue[]>();
  for (const issue of issues) {
    const list = byPath.get(issue.path) ?? [];
    list.push(issue);
    byPath.set(issue.path, list);
  }

  const paths = Array.from(byPath.keys()).sort();
  for (const p of paths) {
    console.log(`${p}`);
    const sorted = byPath.get(p)!.sort((a, b) => a.code.localeCompare(b.code));
    for (const issue of sorted) {
      const marker = issue.severity === "error" ? "✗" : "⚠";
      console.log(`  ${marker} ${issue.code}: ${issue.message}`);
      if (issue.suggestion) console.log(`    → ${issue.suggestion}`);
    }
  }
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
