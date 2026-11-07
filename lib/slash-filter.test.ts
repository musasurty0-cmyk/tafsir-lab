import { describe, it, expect } from "vitest";
import { filterCommands, type SlashCommandItem } from "@/components/workspace/editor/SlashCommand";

const cmd = (id: string, title: string, aliases: string[] = []): SlashCommandItem =>
  ({ id, title, aliases, description: "", icon: "", execute: () => {} } as unknown as SlashCommandItem);

const items = [
  cmd("h1", "Heading 1", ["heading", "title"]),
  cmd("h2", "Heading 2", ["subheading"]),
  cmd("h3", "Heading 3", ["subheading"]),
  cmd("ayah", "Ayah block", ["a", "verse"]),
  cmd("task", "Task list", ["todo"]),
  cmd("bullet", "Bullet list", ["ul"]),
];
const first = (q: string) => filterCommands(items, q)[0]?.id;

describe("filterCommands", () => {
  it("takes a spelled-out title over the first word's alias", () => {
    expect(first("heading 2")).toBe("h2");
    expect(first("heading 3")).toBe("h3");
    expect(first("heading 1")).toBe("h1");
  });
  it("still reads the first word alone", () => {
    expect(first("heading")).toBe("h1");
    expect(first("h2")).toBe("h2");
    expect(first("task")).toBe("task");
  });
  it("leaves a parameter to the command it follows", () => {
    expect(first("ayah 2:255")).toBe("ayah");
    expect(first("a 2:1-5")).toBe("ayah");
  });
});
