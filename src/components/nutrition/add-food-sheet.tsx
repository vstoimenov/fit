"use client";

import { X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { eatMenuItem, estimateFood, saveEstimate } from "@/app/app/nutrition/actions";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { transitionFor } from "@/lib/motion";
import {
  applyGrams,
  draftTotals,
  gramsProblem,
  parseGramsInput,
} from "@/lib/nutrition/estimate-draft";
import { formatNumber } from "@/lib/nutrition/format";
import { DRINK_PRESETS, type DrinkPreset } from "@/lib/nutrition/drinks";
import { DIARY_LABEL, type DiarySlot } from "@/lib/nutrition/labels";
import { menuChipsFor, type MenuDish } from "@/lib/nutrition/menu-format";
import { foodTextSchema, type EstimateItem } from "@/lib/nutrition/schema";
import type { FoodItem } from "@/server/nutrition/diary";
import { EstimateRows } from "./estimate-rows";
import { ManualEntry } from "./manual-entry";

const NOT_FOOD = "Не разпознахме храна. Опиши я по-конкретно или въведи ръчно.";
const FAILED = "Не успяхме да изчислим. Опитай пак или въведи ръчно.";
const SAVE_FAILED = "Нещо се обърка. Опитай отново.";
const COMING_SOON = "Изчисляването с думи скоро ще е включено.";

type Phase = "input" | "loading" | "rows";

/** The breakdown being edited: as estimated, as shown, and what she typed in each amount field. */
type Draft = { base: EstimateItem[]; rows: EstimateItem[]; texts: string[] };
const EMPTY_DRAFT: Draft = { base: [], rows: [], texts: [] };

const iconButton =
  "flex size-11 shrink-0 items-center justify-center rounded-full active:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-40";

/**
 * Adds food to one meal: describe it in words (AI breakdown she can edit, then „Запиши“), tap a recent
 * food, or type it by hand. A native modal <dialog>: bottom sheet on a phone, centred on a desktop; the
 * browser traps focus, Esc closes it and the page behind is inert. It always contains a <form>, which
 * keeps the day swipe off while it is open. Mounted only while open, so every opening starts clean and
 * gets its own batch id (a retried or double-tapped save cannot add the rows twice).
 */
export function AddFoodSheet({
  meal,
  day,
  aiEnabled,
  recent,
  menuDishes,
  onClose,
}: {
  meal: DiarySlot;
  day: string;
  aiEnabled: boolean;
  /** Her latest distinct foods, newest first. */
  recent: FoodItem[];
  /** Today's menu dishes not eaten yet; the ones of this meal show as „От менюто“ chips. */
  menuDishes: MenuDish[];
  onClose: () => void;
}) {
  const reduced = useReducedMotion() ?? false;
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false); // correct in the same tick, unlike state: double taps
  const [batchId] = useState(() => crypto.randomUUID());
  const menuBatches = useRef(new Map<number, string>()); // one batch id per menu chip per opening
  const [mode, setMode] = useState<"describe" | "manual">(aiEnabled ? "describe" : "manual");
  const [phase, setPhase] = useState<Phase>("input");
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const titleId = `add-title-${meal}`;

  // Open as a modal once mounted. The guard keeps a repeated effect run (Strict Mode) from throwing; no
  // cleanup closes it, because unmounting removes the dialog (and `close` would re-fire onClose).
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  // The page behind must not scroll under the sheet.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Focus follows the screen: the field, the loading note or the breakdown, never a removed button.
  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>("[data-autofocus], input, textarea")?.focus();
  }, [phase, mode]);

  const problems = draft.rows.map((_, i) => {
    const base = draft.base[i];
    return base ? gramsProblem(base, draft.texts[i] ?? "") : null;
  });
  const hasProblem = problems.some((problem) => problem !== null);
  const totals = draftTotals(draft.rows);
  // Something typed that a stray tap on the backdrop must not throw away.
  const dirty = mode === "manual" || text.trim() !== "" || phase !== "input";

  async function calculate() {
    if (busy.current) return;
    if (!foodTextSchema.safeParse(text).success) {
      setMessage("Опиши храната с няколко думи.");
      return;
    }
    busy.current = true;
    setMessage(null);
    setPhase("loading");
    try {
      const result = await estimateFood({ text });
      if (!result.ok) {
        setMessage(result.message);
        setPhase("input");
      } else if (result.data.items.length === 0) {
        setMessage(NOT_FOOD);
        setPhase("input");
      } else {
        const items = result.data.items;
        setDraft({ base: items, rows: items, texts: items.map((item) => String(item.grams)) });
        setPhase("rows");
      }
    } catch {
      setMessage(FAILED);
      setPhase("input");
    } finally {
      busy.current = false;
    }
  }

  function changeGrams(index: number, raw: string) {
    setMessage(null);
    setDraft((d) => {
      const grams = parseGramsInput(raw);
      // An amount that does not fit keeps the last good numbers on screen; the field says why.
      const rows = grams === null ? d.rows : applyGrams(d.rows, index, grams, d.base);
      return { ...d, rows, texts: d.texts.map((t, i) => (i === index ? raw : t)) };
    });
  }

  function removeRow(index: number) {
    setMessage(null);
    if (draft.rows.length <= 1) {
      // Nothing left to save: back to the description, which is still there.
      setDraft(EMPTY_DRAFT);
      setPhase("input");
      return;
    }
    const without = <T,>(list: T[]) => list.filter((_, i) => i !== index);
    setDraft((d) => ({ base: without(d.base), rows: without(d.rows), texts: without(d.texts) }));
  }

  async function persist(
    items: EstimateItem[] | FoodItem[],
    source: "ai" | "recent" | "preset",
    id: string,
  ) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setMessage(null);
    try {
      const result = await saveEstimate({ day, meal, batchId: id, source, items });
      if (result.ok) {
        onClose();
        return;
      }
      setMessage(result.message);
    } catch {
      setMessage(SAVE_FAILED);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  // One tap logs the menu dish as the menu does, with this opening's batch id for the chip.
  async function eatFromMenu(dish: MenuDish) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setMessage(null);
    try {
      const id = menuBatches.current.get(dish.slot) ?? crypto.randomUUID();
      menuBatches.current.set(dish.slot, id);
      const result = await eatMenuItem({ day, slot: dish.slot, batchId: id, mealId: dish.mealId });
      if (result.ok) {
        onClose();
        return;
      }
      setMessage(result.message);
    } catch {
      setMessage(SAVE_FAILED);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (phase === "rows") {
      if (!hasProblem) void persist(draft.rows, "ai", batchId);
    } else if (phase === "input") {
      void calculate();
    }
  }

  const drinks = meal === "drinks";
  const unit = drinks ? "мл" : "г";
  const menuChips = menuChipsFor(meal, menuDishes);
  const menuChipList =
    menuChips.length > 0 ? (
      <MenuChips dishes={menuChips} disabled={saving} onPick={(dish) => void eatFromMenu(dish)} />
    ) : null;

  // One tap logs a usual portion of a common drink; the amount can be changed in the diary afterwards.
  const drinkChips = drinks ? (
    <DrinkChips
      disabled={saving}
      onPick={(drink) =>
        void persist(
          [
            {
              name: drink.name,
              grams: drink.grams,
              kcal: drink.kcal,
              proteinG: drink.proteinG,
              carbsG: drink.carbsG,
              fatG: drink.fatG,
            },
          ],
          "preset",
          crypto.randomUUID(),
        )
      }
    />
  ) : null;

  // One tap adds the food with its last amount, as its own batch.
  const recentChips =
    recent.length > 0 ? (
      <RecentChips
        recent={recent}
        disabled={saving}
        onPick={(food) => void persist([food], "recent", crypto.randomUUID())}
      />
    ) : null;

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // A save in flight must finish (its result closes the sheet); everything else may be abandoned.
        if (saving) event.preventDefault();
      }}
      onClose={onClose}
      onClick={(event) => {
        // A tap on the dimmed backdrop closes the sheet, unless it would throw away what she typed.
        if (event.target === event.currentTarget && !dirty && !saving) onClose();
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-3xl bg-white p-0 text-ink shadow-xl backdrop:bg-ink/40 open:flex open:flex-col md:inset-0 md:m-auto md:h-fit md:max-h-[85dvh] md:max-w-lg md:rounded-3xl"
    >
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitionFor(reduced, "page")}
        className="flex min-h-0 flex-1 flex-col"
      >
        <header className="flex items-center justify-between gap-3 px-5 pt-3">
          <h2 id={titleId} className="text-lg font-extrabold">
            Добави · {DIARY_LABEL[meal]}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Затвори добавянето"
            className={cn(iconButton, "-mr-2")}
          >
            <X size={22} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {mode === "manual" ? (
            <div className="space-y-4">
              {/* The quick drinks need no AI: they are there in the hand-typed mode too. */}
              {drinkChips}
              {!aiEnabled && !drinks && <p className="text-sm text-ink-soft">{COMING_SOON}</p>}
              {aiEnabled && (
                <Button variant="link" onClick={() => setMode("describe")}>
                  Опиши с думи
                </Button>
              )}
              {menuChipList}
              {recentChips}
              {message && (
                <p role="alert" className="text-sm text-brick">
                  {message}
                </p>
              )}
              <ManualEntry day={day} meal={meal} onDone={onClose} />
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-4">
              {phase === "input" && (
                <>
                  <div className="space-y-2">
                    {drinkChips}
                    <label htmlFor="food-text" className="block text-sm font-semibold">
                      {drinks ? "Друга напитка? Опиши я" : "Какво яде?"}
                    </label>
                    <textarea
                      id="food-text"
                      data-autofocus
                      value={text}
                      onChange={(event) => {
                        setText(event.target.value);
                        setMessage(null);
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          !event.shiftKey &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault();
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                      rows={3}
                      maxLength={300}
                      enterKeyHint="send"
                      autoComplete="off"
                      placeholder={
                        drinks
                          ? "голямо лате с овесено мляко, 2 бири"
                          : "пилешка салата и филия пълнозърнест хляб"
                      }
                      aria-describedby="food-privacy"
                      aria-invalid={message !== null}
                      className={cn(inputClass, "h-auto resize-none py-3")}
                    />
                    <p id="food-privacy" className="text-xs text-ink-soft">
                      {drinks
                        ? "Например „чаша прясно мляко“ или „0,5 бира“."
                        : "Например „3 пържени мекици“ или „2 яйца и филия хляб“."}{" "}
                      Изпращаме само този текст, без лични данни.
                    </p>
                  </div>
                  {message && (
                    <p role="alert" className="text-sm text-brick">
                      {message}
                    </p>
                  )}
                  <Button type="submit" size="md" className="w-full">
                    Изчисли калориите
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    className="w-full"
                    onClick={() => {
                      setMessage(null);
                      setMode("manual");
                    }}
                  >
                    Въведи ръчно
                  </Button>
                  {menuChipList}
                  {recentChips}
                </>
              )}

              {phase === "loading" && (
                <div
                  role="status"
                  tabIndex={-1}
                  data-autofocus
                  className="space-y-3 py-2 outline-none"
                >
                  <p className="text-sm font-semibold">Изчисляваме…</p>
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      aria-hidden="true"
                      className="h-14 rounded-2xl bg-sand"
                      animate={reduced ? undefined : { opacity: [0.5, 1, 0.5] }}
                      transition={
                        reduced ? undefined : { duration: 1.4, repeat: Infinity, delay: i * 0.18 }
                      }
                    />
                  ))}
                </div>
              )}

              {phase === "rows" && (
                <>
                  <div>
                    <h3 tabIndex={-1} data-autofocus className="font-extrabold outline-none">
                      Провери и поправи
                    </h3>
                    <p className="text-xs text-ink-soft">
                      Нагласи количеството с − и + или махни ред. Числата са ориентир.
                    </p>
                  </div>
                  <EstimateRows
                    unit={unit}
                    rows={draft.rows}
                    base={draft.base}
                    texts={draft.texts}
                    problems={problems}
                    disabled={saving}
                    onGrams={changeGrams}
                    onRemove={removeRow}
                  />
                  <p className="rounded-2xl bg-sand px-4 py-3 text-sm">
                    <span className="font-extrabold">Общо ≈ {formatNumber(totals.kcal)} ккал</span>
                    <span className="block text-xs text-ink-soft">
                      белтъчини {formatNumber(totals.proteinG)} г · въглехидрати{" "}
                      {formatNumber(totals.carbsG)} г · мазнини {formatNumber(totals.fatG)} г
                    </span>
                  </p>
                  {message && (
                    <p role="alert" className="text-sm text-brick">
                      {message}
                    </p>
                  )}
                  <Button
                    type="submit"
                    size="md"
                    className="w-full"
                    disabled={saving || hasProblem}
                  >
                    Запиши
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    className="w-full"
                    disabled={saving}
                    onClick={() => {
                      setMessage(null);
                      setPhase("input");
                    }}
                  >
                    Промени описанието
                  </Button>
                </>
              )}
            </form>
          )}
        </div>
      </motion.div>
    </dialog>
  );
}

/** The common drinks: one tap logs one usual portion (ml and ≈ kcal on the chip). */
function DrinkChips({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (drink: DrinkPreset) => void;
}) {
  return (
    <section aria-label="Бързо добавяне на напитка" className="space-y-2">
      <h3 className="text-sm font-semibold">Бързо добавяне</h3>
      <ul className="flex flex-wrap gap-2">
        {DRINK_PRESETS.map((drink) => (
          <li key={drink.name}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(drink)}
              className="inline-flex min-h-11 flex-col items-start justify-center rounded-2xl px-4 py-1.5 text-left ring-[1.5px] ring-inset ring-line active:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-40"
            >
              <span className="text-sm font-semibold">{drink.name}</span>
              <span className="text-xs text-ink-soft">
                {formatNumber(drink.grams)} мл · {formatNumber(drink.kcal)} ккал
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Her recent foods: one tap adds the food with its last amount. */
function RecentChips({
  recent,
  disabled,
  onPick,
}: {
  recent: FoodItem[];
  disabled: boolean;
  onPick: (food: FoodItem) => void;
}) {
  return (
    <section aria-label="Наскоро добавяни" className="space-y-2">
      <h3 className="text-sm font-semibold">Наскоро</h3>
      <ul className="flex flex-wrap gap-2">
        {recent.map((food) => (
          <li key={food.name}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(food)}
              className="inline-flex min-h-11 items-center rounded-full px-4 text-left text-sm font-semibold ring-[1.5px] ring-inset ring-line active:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-40"
            >
              {food.name} · {formatNumber(food.kcal)} ккал
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Today's menu dishes for this meal: one tap logs the dish with her portion, like „Изядох го“. */
function MenuChips({
  dishes,
  disabled,
  onPick,
}: {
  dishes: MenuDish[];
  disabled: boolean;
  onPick: (dish: MenuDish) => void;
}) {
  return (
    <section aria-label="От менюто" className="space-y-2">
      <h3 className="text-sm font-semibold">От менюто</h3>
      <ul className="flex flex-wrap gap-2">
        {dishes.map((dish) => (
          <li key={dish.slot}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(dish)}
              className="inline-flex min-h-11 items-center rounded-full px-4 text-left text-sm font-semibold ring-[1.5px] ring-inset ring-line active:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-40"
            >
              {dish.title} · {formatNumber(dish.kcal)} ккал
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
