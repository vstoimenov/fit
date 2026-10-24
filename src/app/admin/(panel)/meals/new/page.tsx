import { createMealAction } from "../actions";
import { MealForm } from "../meal-form";

export const metadata = { title: "Ново ястие" };

export default function NewMealPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold">Ново ястие</h1>
      <MealForm action={createMealAction} />
    </div>
  );
}
