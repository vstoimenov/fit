/** A legal document as plain data: headings with paragraphs (strings) and bullet lists (arrays). */
export type LegalDoc = {
  title: string;
  /** Shown as „Последна промяна: …“. */
  updated: string;
  sections: { heading: string; blocks: (string | string[])[] }[];
};

export type Operator = { name: string; eik: string; address: string };

/** Who runs the club, as one line; an honest note until the owner supplies the company details. */
export function operatorLine(operator: Operator): string {
  if (!operator.name || !operator.eik || !operator.address) {
    return "Наименованието, ЕИК и адресът на търговеца ще бъдат публикувани тук преди старта на продажбите.";
  }
  return `${operator.name}, ЕИК ${operator.eik}, адрес: ${operator.address}`;
}
