import { describe, expect, it } from "vitest";
import { formatDuration, formatMoney, plural } from "@/game/core/format";

describe("formatMoney", () => {
  it("keeps whole numbers intact", () => {
    expect(formatMoney(0)).toBe("0");
    expect(formatMoney(15)).toBe("15");
    expect(formatMoney(100)).toBe("100");
    expect(formatMoney(999)).toBe("999");
  });

  it("shortens thousands and millions without eating zeros", () => {
    expect(formatMoney(1000)).toBe("1K");
    expect(formatMoney(1500)).toBe("1.5K");
    expect(formatMoney(1234)).toBe("1.23K");
    expect(formatMoney(10_000)).toBe("10K");
    expect(formatMoney(12_000)).toBe("12K");
    expect(formatMoney(100_000)).toBe("100K");
    expect(formatMoney(200_000)).toBe("200K");
    expect(formatMoney(450_000)).toBe("450K");
    expect(formatMoney(1_000_000)).toBe("1M");
    expect(formatMoney(6_000_000)).toBe("6M");
    expect(formatMoney(60_200_000)).toBe("60.2M");
  });

  it("truncates instead of rounding up", () => {
    expect(formatMoney(999_999)).toBe("999K");
    expect(formatMoney(1999)).toBe("1.99K");
  });
});

describe("formatDuration / plural", () => {
  it("formats durations in Russian", () => {
    expect(formatDuration(42)).toBe("42 с");
    expect(formatDuration(125)).toBe("2 мин 5 с");
    expect(formatDuration(3720)).toBe("1 ч 2 мин");
  });

  it("picks Russian plural forms", () => {
    const f: [string, string, string] = ["предмет", "предмета", "предметов"];
    expect(plural(1, f)).toBe("предмет");
    expect(plural(3, f)).toBe("предмета");
    expect(plural(11, f)).toBe("предметов");
    expect(plural(25, f)).toBe("предметов");
  });
});
