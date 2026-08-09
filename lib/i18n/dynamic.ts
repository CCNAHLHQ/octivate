import { readCollection } from "@/lib/store/json-store";
import type { MarqueeItem } from "@/lib/types";
import type { MessageDict } from "@/lib/i18n/messages";

/** Build dynamic English source from live marquee/signal items. */
export async function loadDynamicEnglish(): Promise<MessageDict> {
  const items = await readCollection<MarqueeItem>("marquee", []);
  const out: MessageDict = {};
  for (const item of items) {
    if (!item?.id) continue;
    const text = String(item.text || "").trim();
    if (text) out[`dyn.marquee.${item.id}.text`] = text;
    const badge = String(item.badge || "").trim();
    if (badge) out[`dyn.marquee.${item.id}.badge`] = badge;
  }
  return out;
}

export function applyDynamicTranslations(
  items: MarqueeItem[],
  messages: MessageDict
): MarqueeItem[] {
  return items.map((item) => {
    const textKey = `dyn.marquee.${item.id}.text`;
    const badgeKey = `dyn.marquee.${item.id}.badge`;
    return {
      ...item,
      text: messages[textKey] || item.text,
      badge: messages[badgeKey] || item.badge,
    };
  });
}
