import type { Stack } from "./types";

// Mirrors wireframe/board.html's mock data — gives a first-run app
// something to look at instead of a blank board, and doubles as a manual
// test fixture for every interaction (dated/undated, done/cancelled,
// notes, an archived paper to browse).
export function seedStacks(): Stack[] {
  const now = Date.now();
  const daysAgo = (days: number, hours = 0) =>
    new Date(now - days * 86_400_000 - hours * 3_600_000).toISOString();

  return [
    {
      id: "home",
      name: "Home",
      lastInteractionAt: daysAgo(0),
      currentPaper: {
        paperIndex: 23,
        createdAt: daysAgo(12),
        themes: [
          { id: "t1", text: "shopping for anniversary", date: "2026-08-20", state: "live", statusAt: null, x: 380, y: 260 },
          { id: "t2", text: "renovate bathroom", date: null, state: "live", statusAt: null, x: 900, y: 420 },
          { id: "t3", text: "shopping centre", date: null, state: "live", statusAt: null, x: 640, y: 760 },
          { id: "t4", text: "prep for school", date: null, state: "live", statusAt: null, x: 1180, y: 200 },
          { id: "t5", text: "learn chess", date: null, state: "live", statusAt: null, x: 220, y: 640 },
          { id: "t6", text: "renew passport", date: "2026-09-02", state: "live", statusAt: null, x: 1120, y: 660 },
        ],
        items: [
          { id: "i1", themeId: "t1", text: "cake", date: null, state: "live", x: 480, y: 190, notes: [] },
          {
            id: "i2", themeId: "t1", text: "call cleaner", date: null, state: "done", x: 300, y: 190,
            notes: [{ text: "Kristina, 070-555-1212", done: false }],
          },
          { id: "i3", themeId: "t1", text: "check w/ mom re: present", date: null, state: "live", x: 470, y: 330, notes: [] },
          { id: "i4", themeId: "t1", text: "book restaurant", date: "2026-08-19", state: "done", x: 300, y: 330, notes: [] },
          {
            id: "i5", themeId: "t2", text: "get stuff at bauhaus", date: null, state: "live", x: 1010, y: 350,
            notes: [
              { text: "paint", done: false },
              { text: "brush", done: false },
              { text: "tape", done: true },
              { text: "paper", done: false },
            ],
          },
          { id: "i6", themeId: "t2", text: "book plumber", date: null, state: "live", x: 990, y: 500, notes: [] },
          { id: "i7", themeId: "t3", text: "new towels", date: null, state: "live", x: 560, y: 830, notes: [] },
          { id: "i8", themeId: "t3", text: "batteries", date: null, state: "done", x: 710, y: 830, notes: [] },
          { id: "i9", themeId: "t4", text: "buy pencil case", date: null, state: "live", x: 1260, y: 150, notes: [] },
          {
            id: "i10", themeId: "t4", text: "call joe re: carpool", date: null, state: "cancelled", x: 1250, y: 280,
            notes: [{ text: "Joe — 073-222-9090, ask about Tue/Thu pickup", done: false }],
          },
          { id: "i11", themeId: "t6", text: "passport photo", date: null, state: "live", x: 1200, y: 590, notes: [] },
        ],
      },
      archive: [
        {
          paperIndex: 22,
          createdAt: daysAgo(26),
          retiredAt: daysAgo(12),
          themes: [
            { id: "arc22t1", text: "summer holiday packing", date: "2026-07-10", state: "done", statusAt: daysAgo(13), x: 400, y: 260 },
            { id: "arc22t2", text: "fix garden fence", date: null, state: "done", statusAt: daysAgo(14), x: 850, y: 380 },
            { id: "arc22t3", text: "learn ukulele", date: null, state: "cancelled", statusAt: daysAgo(12), x: 620, y: 640 },
          ],
          items: [
            { id: "arc22i1", themeId: "arc22t1", text: "buy sunscreen", date: null, state: "done", x: 300, y: 190, notes: [] },
            { id: "arc22i2", themeId: "arc22t1", text: "print boarding passes", date: null, state: "done", x: 500, y: 190, notes: [] },
            { id: "arc22i3", themeId: "arc22t2", text: "buy new posts", date: null, state: "done", x: 950, y: 300, notes: [] },
          ],
        },
      ],
    },
    {
      id: "work",
      name: "Work",
      lastInteractionAt: daysAgo(2, 3),
      currentPaper: {
        paperIndex: 5,
        createdAt: daysAgo(9),
        themes: [
          { id: "wt1", text: "Q3 report", date: "2026-08-25", state: "live", statusAt: null, x: 420, y: 260 },
          { id: "wt2", text: "hire contractor", date: null, state: "live", statusAt: null, x: 900, y: 300 },
          { id: "wt3", text: "expense receipts", date: null, state: "live", statusAt: null, x: 620, y: 620 },
        ],
        items: [
          { id: "wi1", themeId: "wt1", text: "pull sales numbers", date: null, state: "done", x: 300, y: 200, notes: [] },
          { id: "wi2", themeId: "wt1", text: "draft slides", date: "2026-08-24", state: "live", x: 520, y: 210, notes: [] },
          { id: "wi3", themeId: "wt2", text: "post job ad", date: null, state: "live", x: 990, y: 230, notes: [] },
          { id: "wi4", themeId: "wt2", text: "screen candidates", date: null, state: "live", x: 990, y: 380, notes: [] },
          {
            id: "wi5", themeId: "wt3", text: "scan taxi receipts", date: null, state: "cancelled", x: 700, y: 560,
            notes: [{ text: "lost the paper ones — ask finance for reissue", done: false }],
          },
        ],
      },
      archive: [],
    },
    {
      id: "renovation",
      name: "Renovation",
      lastInteractionAt: daysAgo(0, 1),
      currentPaper: {
        paperIndex: 1,
        createdAt: daysAgo(0, 1),
        themes: [
          { id: "rt1", text: "bathroom retile", date: null, state: "live", statusAt: null, x: 420, y: 300 },
          { id: "rt2", text: "kitchen quote", date: "2026-09-10", state: "live", statusAt: null, x: 900, y: 420 },
        ],
        items: [
          { id: "ri1", themeId: "rt1", text: "pick tile colour", date: null, state: "live", x: 300, y: 230, notes: [] },
          { id: "ri2", themeId: "rt2", text: "call 2nd contractor", date: null, state: "live", x: 1000, y: 350, notes: [] },
        ],
      },
      archive: [],
    },
  ];
}
