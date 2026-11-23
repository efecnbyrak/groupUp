import { describe, expect, it } from "vitest";

import { candidateDomains } from "./domain-match";

describe("candidateDomains", () => {
  it("tam eşleşmeden üst domainlere sıralar", () => {
    expect(candidateDomains("Ali@A.Ogr.Kent.edu.tr")).toEqual(["a.ogr.kent.edu.tr", "ogr.kent.edu.tr", "kent.edu.tr", "edu.tr"]);
  });
  it("tek seviye", () => {
    expect(candidateDomains("x@ogr.kent.edu.tr")).toEqual(["ogr.kent.edu.tr", "kent.edu.tr", "edu.tr"]);
  });
  it("geçersiz mail", () => {
    expect(candidateDomains("foo")).toEqual([]);
    expect(candidateDomains("@kent.edu.tr")).toEqual([]);
  });
  it("iki etiketli domain", () => {
    expect(candidateDomains("x@uni.de")).toEqual(["uni.de"]);
  });
});
