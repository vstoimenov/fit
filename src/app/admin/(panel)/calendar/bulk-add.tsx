"use client";

import { Fragment, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { distributeDates } from "@/lib/admin/schedule";
import { utcToZoned } from "@/lib/admin/time";
import { LEVEL_LABEL } from "@/lib/labels";
import type { Level } from "@/lib/program/types";
import type { BulkRow, LinkPreview } from "@/server/admin/bulk";
import { previewLinksAction, saveBulkAction } from "./actions";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

export function BulkAdd({ today }: { today: string }) {
  const [text, setText] = useState("");
  const [previews, setPreviews] = useState<LinkPreview[]>([]);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [level, setLevel] = useState<Level>("beginner");
  const [start, setStart] = useState(today);
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [time, setTime] = useState("07:00");
  const [message, setMessage] = useState("");
  const [hint, setHint] = useState("");
  // errors from the last save, keyed by the row's video link (unique per row)
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function preview() {
    startTransition(async () => {
      const r = await previewLinksAction(text);
      if (!r.ok) return setMessage(r.message);
      setPreviews(r.data);
      setRows(
        r.data
          .filter((p) => p.ok)
          .map((p) => ({
            videoUrl: p.videoUrl!,
            title: p.title!,
            level,
            durationMin: p.durationMin!,
            date: "",
            time,
            notify: true,
            thumbnailSourceUrl: p.thumbnailSourceUrl ?? null,
          })),
      );
      setRowErrors({});
      setHint("");
      setMessage("");
    });
  }

  function distribute() {
    if (!start) return setHint("Избери начална дата.");
    if (days.length === 0) return setHint("Избери поне един ден от седмицата.");
    if (!time) return setHint("Избери час.");
    setHint("");
    let dates: string[];
    try {
      dates = distributeDates({ startDate: start, weekdays: days, time, count: rows.length });
    } catch {
      return setHint("Невалидна дата или час.");
    }
    setRows(
      rows.map((row, i) => ({
        ...row,
        level,
        time,
        ...(dates[i] ? { date: utcToZoned(dates[i]!).date } : {}),
      })),
    );
  }

  function update(i: number, patch: Partial<BulkRow>) {
    const key = rows[i]?.videoUrl;
    if (key && rowErrors[key])
      setRowErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key)));
    setRows(rows.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }

  function save() {
    startTransition(async () => {
      const r = await saveBulkAction(rows);
      if (!r.ok) return setMessage(r.message);
      const { created, errors } = r.data;
      if (errors.length === 0) {
        setMessage(`Създадени: ${created}.`);
        setText("");
        setPreviews([]);
        setRows([]);
        setRowErrors({});
        return;
      }
      // Keep only the rows that failed, so a retry cannot create the saved ones twice.
      const failedAt = new Map(errors.map((e) => [e.index, e.message]));
      const failedRows = rows.filter((_, i) => failedAt.has(i));
      setRows(failedRows);
      setRowErrors(
        Object.fromEntries(
          failedRows.map((row) => [row.videoUrl, failedAt.get(rows.indexOf(row))!]),
        ),
      );
      setText("");
      setPreviews([]);
      setMessage(
        `Създадени: ${created}. Остават ${failedRows.length} с грешка — поправи ги и запази отново.`,
      );
    });
  }

  return (
    <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-line">
      <h2 className="font-semibold">Добави няколко</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={"Постави линкове, по един на ред\nhttps://youtu.be/…"}
        className={inputClass + " h-auto py-3"}
      />
      <Button size="md" disabled={pending || !text.trim()} onClick={preview}>
        Провери линковете
      </Button>

      {previews.some((p) => !p.ok) && (
        <ul className="space-y-1 text-sm text-brick">
          {previews
            .filter((p) => !p.ok)
            .map((p) => (
              <li key={p.line}>
                Ред {p.line}: {p.error}
              </li>
            ))}
        </ul>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-end gap-3 rounded-xl bg-sand p-3 text-sm">
            <label className="space-y-1">
              <span className="block font-semibold">Ниво за всички</span>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as Level)}
                className={inputClass + " h-11"}
              >
                {Object.entries(LEVEL_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block font-semibold">От дата</span>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className={inputClass + " h-11"}
              />
            </label>
            <fieldset className="space-y-1">
              <legend className="font-semibold">Дни</legend>
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                {WEEKDAYS.map((d, i) => (
                  <label key={d} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={days.includes(i)}
                      onChange={(e) =>
                        setDays(e.target.checked ? [...days, i] : days.filter((x) => x !== i))
                      }
                    />
                    {d}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="space-y-1">
              <span className="block font-semibold">Час</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={inputClass + " h-11"}
              />
            </label>
            <Button variant="quiet" size="md" onClick={distribute}>
              Разпредели автоматично
            </Button>
            {hint && (
              <p role="alert" className="basis-full text-brick">
                {hint}
              </p>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-ink-soft">
                <tr>
                  <th className="p-2">Заглавие</th>
                  <th className="p-2">Ниво</th>
                  <th className="p-2">Мин</th>
                  <th className="p-2">Дата</th>
                  <th className="p-2">Час</th>
                  <th className="p-2">Известие</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <Fragment key={row.videoUrl}>
                    <tr className="border-t border-line">
                      <td className="p-2">
                        <input
                          value={row.title}
                          onChange={(e) => update(i, { title: e.target.value })}
                          className={inputClass + " h-10"}
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={row.level}
                          onChange={(e) => update(i, { level: e.target.value as Level })}
                          className={inputClass + " h-10"}
                        >
                          {Object.entries(LEVEL_LABEL).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={1}
                          max={180}
                          value={row.durationMin}
                          onChange={(e) => update(i, { durationMin: Number(e.target.value) })}
                          className={inputClass + " h-10 w-20"}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) => update(i, { date: e.target.value })}
                          className={inputClass + " h-10"}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="time"
                          value={row.time}
                          onChange={(e) => update(i, { time: e.target.value })}
                          className={inputClass + " h-10"}
                        />
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.notify}
                          onChange={(e) => update(i, { notify: e.target.checked })}
                        />
                      </td>
                    </tr>
                    {rowErrors[row.videoUrl] && (
                      <tr>
                        <td colSpan={6} className="px-2 pb-2 text-sm text-brick">
                          {rowErrors[row.videoUrl]}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <Button size="md" disabled={pending || rows.some((r) => !r.date)} onClick={save}>
            Запази {rows.length} {rows.length === 1 ? "тренировка" : "тренировки"}
          </Button>
        </>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
