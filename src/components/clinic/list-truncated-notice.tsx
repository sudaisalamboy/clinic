/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

/**
 * Truncation notice for server-paginated lists.
 *
 * List endpoints return at most one page (default 500 rows — see
 * parsePagination in src/lib/api-utils.ts) plus the true matching count in
 * the `X-Total-Count` header. Without this notice the 501st record is
 * silently invisible: the user has no signal that filters are needed to
 * see older rows.
 */
export function ListTruncatedNotice({ shown, total }: { shown: number; total: number }) {
  if (!total || total <= shown) return null
  return (
    <p role="status" className="py-3 text-center text-xs text-muted-foreground">
      Showing the latest {shown} of {total} records — refine the search or date filters
      to see older ones.
    </p>
  )
}
