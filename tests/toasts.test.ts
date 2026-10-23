import { afterEach, describe, expect, it, vi } from "vitest";
import { pushToast, useUI } from "@/runtime/store";

describe("toasts", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("a burst of toasts queues instead of pushing older ones away", () => {
    vi.useFakeTimers();
    const texts = ["Пришла зима", "Сезонный спрос", "Достижение", "Новая шляпа", "Ярмарка"];
    for (const t of texts) pushToast(t, "•");
    expect(useUI.getState().toasts.map((t) => t.text)).toEqual(texts.slice(0, 3));
    vi.advanceTimersByTime(3300);
    expect(useUI.getState().toasts.map((t) => t.text)).toEqual(texts.slice(3));
    vi.advanceTimersByTime(3300);
    expect(useUI.getState().toasts).toEqual([]);
  });
});
