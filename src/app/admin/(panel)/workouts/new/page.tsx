import { createWorkoutAction } from "../actions";
import { WorkoutForm } from "../workout-form";

export const metadata = { title: "Нова тренировка" };

export default function NewWorkoutPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold">Нова тренировка</h1>
      <WorkoutForm action={createWorkoutAction} />
    </div>
  );
}
