import { createMealAction } from "../actions";
import { MealForm } from "../meal-form";

export const metadata = { title: "Ново ястие" };

// The AI draft (a server action invoked from this page) may take up to 30 s; Server Actions inherit
// the page's limit.
export const maxDuration = 30;

export default function NewMealPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold">Ново ястие</h1>
      <MealForm action={createMealAction} />
    </div>
  );
}
