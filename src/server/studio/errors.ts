/** The studio RPCs raise short English reasons; she reads Bulgarian. */
const MESSAGES: [reason: string, copy: string][] = [
  ["session cancelled", "Тренировката е отменена."],
  ["already booked", "Вече си записана за тази тренировка."],
  ["full", "Няма свободни места."],
  ["started", "Тренировката вече започна."],
  ["not open", "Записването отваря месец преди тренировката."],
  ["too late", "Вече не може да се откаже — остават по-малко от 6 часа."],
  ["card in use", "От картата вече има записвания. Коригирай посещенията вместо да я анулираш."],
  ["negative", "Остатъкът не може да стане отрицателен."],
  ["invalid invite", "Поканата е невалидна или изтекла."],
];

export function studioErrorMessage(dbMessage: string): string {
  return (
    MESSAGES.find(([reason]) => dbMessage.includes(reason))?.[1] ?? "Нещо се обърка. Опитай отново."
  );
}
