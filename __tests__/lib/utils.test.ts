import {
  slugify,
  calcReadTime,
  generateExcerpt,
  formatDate,
  tweetUrl,
} from "@/lib/utils";

describe("slugify", () => {
  it("converts text to lowercase kebab-case", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips special characters", () => {
    expect(slugify("What's the Value? (A Breakdown)")).toBe(
      "whats-the-value-a-breakdown"
    );
  });

  it("collapses consecutive separators", () => {
    expect(slugify("too   many---spaces")).toBe("too-many-spaces");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  -trimmed-  ")).toBe("trimmed");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });
});

describe("calcReadTime", () => {
  it("returns 1 minute for short content", () => {
    expect(calcReadTime("Short text")).toBe(1);
  });

  it("calculates based on 200 wpm", () => {
    const words = Array(400).fill("word").join(" ");
    expect(calcReadTime(words)).toBe(2);
  });

  it("rounds to nearest minute", () => {
    const words = Array(500).fill("word").join(" ");
    expect(calcReadTime(words)).toBe(3);
  });
});

describe("generateExcerpt", () => {
  it("returns full text if shorter than max length", () => {
    expect(generateExcerpt("Short text")).toBe("Short text");
  });

  it("truncates at word boundary with ellipsis", () => {
    const long = "word ".repeat(50).trim();
    const excerpt = generateExcerpt(long, 30);
    expect(excerpt.length).toBeLessThanOrEqual(35); // room for ellipsis
    expect(excerpt).toMatch(/…$/);
  });

  it("strips HTML tags", () => {
    expect(generateExcerpt("<p>Hello <strong>world</strong></p>")).toBe(
      "Hello world"
    );
  });
});

describe("formatDate", () => {
  it("returns empty string for null", () => {
    expect(formatDate(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatDate(undefined)).toBe("");
  });

  it("formats a Date object", () => {
    const date = new Date(2025, 0, 15); // Jan 15 2025 in local time
    const result = formatDate(date);
    expect(result).toContain("January");
    expect(result).toContain("15");
    expect(result).toContain("2025");
  });

  it("handles Firestore-like toDate objects", () => {
    const firestoreDate = { toDate: () => new Date(2024, 5, 1) }; // June 1 2024 local
    const result = formatDate(firestoreDate);
    expect(result).toContain("June");
    expect(result).toContain("2024");
  });
});

describe("tweetUrl", () => {
  it("creates a properly encoded Twitter intent URL", () => {
    const url = tweetUrl("Check this out!", "https://the-un-official.com");
    expect(url).toContain("twitter.com/intent/tweet");
    expect(url).toContain(encodeURIComponent("Check this out!"));
    expect(url).toContain(encodeURIComponent("https://the-un-official.com"));
  });
});
