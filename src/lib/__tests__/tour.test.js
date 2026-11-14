import { describe, it, expect } from "vitest";
import { readTour, writeTour, nextTourVisit, TOUR_STEPS, TOUR_MAX_VISITS, TOUR_KEY } from "../tour.js";
import { STUDENT_STORAGE_KEYS } from "../api.js";
import { VIEW_PATHS } from "../../routes.js";

const mem = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };

describe("welcome tour", () => {
  it("shows on the first four visits and then stops", () => {
    const st = mem(); const shown = [];
    for (let i = 0; i < 6; i++) { const { show, state } = nextTourVisit(readTour(st)); writeTour(st, state); shown.push(show); }
    expect(TOUR_MAX_VISITS).toBe(4);
    expect(shown).toEqual([true, true, true, true, false, false]);
  });
  it("never shows again once the visitor says so", () => {
    const st = mem();
    writeTour(st, { ...nextTourVisit(readTour(st)).state, never: true });
    expect(nextTourVisit(readTour(st)).show).toBe(false);
  });
  it("survives unreadable storage", () => {
    expect(readTour({ getItem: () => "not json" })).toEqual({ visits: 0, never: false });
  });
  it("is not wiped at sign-out and holds nothing about the student", () => {
    expect(STUDENT_STORAGE_KEYS).not.toContain(TOUR_KEY);
  });
  it("covers each part of the site and only links to real pages", () => {
    const views = TOUR_STEPS.map(s => s.view).filter(Boolean);
    for (const v of ["profile", "matches", "coach", "search", "generate", "saved"]) expect(views).toContain(v);
    for (const v of views) expect(VIEW_PATHS[v]).toBeTruthy();
    for (const s of TOUR_STEPS) { expect(s.title.length).toBeGreaterThan(5); expect(s.body).not.toMatch(/guarantee|will win/i); }
  });
});
