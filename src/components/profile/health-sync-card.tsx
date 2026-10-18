import { Watch } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";

/**
 * Placeholder for phone/watch sync. Apple Health and Health Connect are reachable only from a store
 * app (not from the PWA), so this stays a "скоро" card until the native wrapper ships.
 */
export function HealthSyncCard() {
  return (
    <Card className="space-y-2 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Watch size={20} aria-hidden="true" />
          Часовник и телефон
        </h2>
        <Chip tone="powder">Скоро</Chip>
      </div>
      <p className="text-ink-soft">
        Свързване с Apple Health и Health Connect: крачките и активностите ти ще влизат тук
        автоматично.
      </p>
    </Card>
  );
}
