import { expect, test } from "vitest";
import { repeated, sentences } from "../tools/repeated-rules.js";

test("a copied sentence is found despite bullets, case and code marks", () => {
  const home = "- Never ask for, print, commit or unlock a secret. Other words here.\n";
  const project = "# Rules\n\n- never ask for, print, commit or unlock a `secret`.\n";
  expect(repeated(home, project)).toEqual(["never ask for print commit or unlock a secret"]);
});

test("short sentences and a project's own rules are not repeats", () => {
  expect(repeated("Checks run in CI. Logic is typed and tested.", "Checks run in CI. Logic is Python.")).toEqual([]);
});

test("table cells and bullets split into separate sentences", () => {
  expect(sentences("| A rule with six words in it | another cell that has six words |")).toEqual(
    new Set(["a rule with six words in it", "another cell that has six words"]),
  );
});
