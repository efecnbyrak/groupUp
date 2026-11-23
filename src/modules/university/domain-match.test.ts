import { describe, expect, it } from "vitest";

import { candidateDomains, normalizeDomain } from "./domain-match";

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

describe("normalizeDomain", () => {
  it("baştaki @, protokol, yol ve büyük harfleri temizler", () => {
    expect(normalizeDomain("@Ogr.Kent.edu.tr")).toBe("ogr.kent.edu.tr");
    expect(normalizeDomain(" https://mezun.kent.edu.tr/giris ")).toBe("mezun.kent.edu.tr");
    expect(normalizeDomain("kent.edu.tr.")).toBe("kent.edu.tr");
  });
  it("geçersiz domainleri reddeder", () => {
    for (const bad of ["", "localhost", "ogr kent.edu.tr", "-ogr.kent.edu.tr", "ogr..kent.edu.tr", "kent.t", "a@b.com.tr", "ögr.kent.edu.tr"]) {
      expect(normalizeDomain(bad), bad).toBeNull();
    }
  });
});
