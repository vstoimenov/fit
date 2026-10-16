"use client";

import { useState, useTransition } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import type { ActionResult } from "@/lib/action-result";
import { LEVEL_LABEL } from "@/lib/labels";
import { slugify } from "@/lib/slugify";
import type { AdminArticle } from "@/server/admin/articles";
import { deleteArticleAction, setPublishedAction } from "./actions";

type FormAction = (
  prev: ActionResult<unknown> | null,
  form: FormData,
) => Promise<ActionResult<unknown>>;

export function ArticleForm({ action, article }: { action: FormAction; article?: AdminArticle }) {
  const [slug, setSlug] = useState(article?.slug ?? "");
  // The address follows the title only until the admin touches it, and never on an existing article.
  const [slugTouched, setSlugTouched] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteArticleAction(id);
      if (!result.ok) setMessage(result.message);
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <ActionForm action={action} submitLabel={article ? "Запази" : "Създай"}>
        <Field label="Заглавие">
          <input
            name="title"
            defaultValue={article?.title}
            required
            maxLength={120}
            onChange={(e) => {
              if (!article && !slugTouched) setSlug(slugify(e.target.value));
            }}
            className={inputClass}
          />
        </Field>
        <Field label="Адрес (slug)" hint="Малки латински букви, цифри и тирета. 3–80 знака.">
          <input
            name="slug"
            value={slug}
            required
            minLength={3}
            maxLength={80}
            pattern="[a-z0-9\-]{3,80}"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            className={inputClass}
          />
        </Field>
        <Field label="Кратко описание (по желание)" hint="До 300 знака, показва се в списъка.">
          <textarea
            name="excerpt"
            defaultValue={article?.excerpt}
            maxLength={300}
            rows={3}
            className={inputClass + " h-auto py-3"}
          />
        </Field>
        <Field
          label="Текст"
          hint="Markdown: **удебелено**, *курсив*, # Заглавие, - списък, [линк](https://…). Поддържат се и таблици и списъци."
        >
          <textarea
            name="body"
            defaultValue={article?.body}
            required
            maxLength={50000}
            rows={16}
            className={inputClass + " h-auto py-3 font-mono text-sm"}
          />
        </Field>
        <Field
          label="Корица (по желание)"
          hint="Линк, който започва с https://, или път /photos/име.jpg (без ? и интервали)"
        >
          <input
            name="coverUrl"
            defaultValue={article?.coverUrl ?? ""}
            maxLength={500}
            autoComplete="off"
            className={inputClass}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ниво">
            <select name="level" defaultValue={article?.level ?? ""} className={inputClass}>
              <option value="">Всички нива</option>
              {Object.entries(LEVEL_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex min-h-11 items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              name="membersOnly"
              defaultChecked={article?.membersOnly ?? false}
            />
            Само за абонатки
          </label>
        </div>
      </ActionForm>

      {article && (
        <section className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          {article.publishedAt ? (
            <ActionForm
              key="unpublish"
              action={() => setPublishedAction(article.id, false)}
              submitLabel="Свали от публикация"
              submitVariant="secondary"
              successMessage="Свалена ✓"
              className="contents"
            >
              {null}
            </ActionForm>
          ) : (
            <ActionForm
              key="publish"
              action={() => setPublishedAction(article.id, true)}
              submitLabel="Публикувай"
              submitVariant="secondary"
              successMessage="Публикувана ✓"
              className="contents"
            >
              {null}
            </ActionForm>
          )}
          <Button
            variant="quiet"
            size="md"
            disabled={pending}
            className="text-brick"
            onClick={() => confirm("Да изтрия ли статията?") && remove(article.id)}
          >
            Изтрий
          </Button>
          {message && (
            <p role="alert" className="text-sm text-brick">
              {message}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
