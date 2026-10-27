"use client";

import { ActionForm } from "@/components/admin/action-form";
import type { CommunityReport } from "@/server/community/admin";
import {
  deleteCommentAction,
  deletePostAction,
  dismissReportAction,
  hideCommentAction,
  hidePostAction,
} from "./actions";

/** Under a report: hide/unhide the reported item, delete that item, dismiss the report. */
export function ReportActions({ report }: { report: CommunityReport }) {
  const isPost = report.post_id !== null;
  const hide = isPost
    ? () => hidePostAction(report.post_id!, !report.hidden)
    : () => hideCommentAction(report.comment_id!, !report.hidden);
  const remove = isPost
    ? () => deletePostAction(report.post_id!)
    : () => deleteCommentAction(report.comment_id!);
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
      <ActionForm
        action={async () => remove()}
        submitLabel={isPost ? "Изтрий публикацията" : "Изтрий коментара"}
        submitVariant="secondary"
        successMessage="Изтрито ✓"
        confirmMessage={
          isPost ? "Да изтрием публикацията с всичките ѝ коментари?" : "Да изтрием този коментар?"
        }
      >
        <span />
      </ActionForm>
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

/** In the latest-posts table: hide/unhide or delete any post, reported or not. */
export function PostActions({ id, hidden }: { id: string; hidden: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionForm
        action={async () => hidePostAction(id, !hidden)}
        submitLabel={hidden ? "Покажи" : "Скрий"}
        submitVariant="secondary"
        successMessage="Готово ✓"
      >
        <span />
      </ActionForm>
      <ActionForm
        action={async () => deletePostAction(id)}
        submitLabel="Изтрий"
        submitVariant="secondary"
        successMessage="Изтрита ✓"
        confirmMessage="Да изтрием публикацията с всичките ѝ коментари?"
      >
        <span />
      </ActionForm>
    </div>
  );
}
