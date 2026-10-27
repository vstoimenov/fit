"use client";

import { ActionForm } from "@/components/admin/action-form";
import type { CommunityReport } from "@/server/community/admin";
import {
  deletePostAction,
  dismissReportAction,
  hideCommentAction,
  hidePostAction,
} from "./actions";

/** The three buttons under a report: hide/unhide the content, delete the post, dismiss the report. */
export function ReportActions({ report }: { report: CommunityReport }) {
  const hide = report.post_id
    ? () => hidePostAction(report.post_id!, !report.hidden)
    : () => hideCommentAction(report.comment_id!, !report.hidden);
  return (
    <div className="flex flex-wrap gap-2">
      <ActionForm
        action={async () => hide()}
        submitLabel={report.hidden ? "Покажи пак" : "Скрий"}
        submitVariant="secondary"
        successMessage="Готово ✓"
      >
        <span />
      </ActionForm>
      {report.context_post_id && (
        <ActionForm
          action={async () => deletePostAction(report.context_post_id!)}
          submitLabel="Изтрий публикацията"
          submitVariant="secondary"
          successMessage="Изтрита ✓"
          confirmMessage="Да изтрием цялата публикация с коментарите ѝ?"
        >
          <span />
        </ActionForm>
      )}
      <ActionForm
        action={async () => dismissReportAction(report.id)}
        submitLabel="Няма проблем"
        submitVariant="secondary"
        successMessage="Затворен ✓"
      >
        <span />
      </ActionForm>
    </div>
  );
}
