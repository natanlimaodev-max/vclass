import { describe, expect, it } from "vitest";
import { createRequire } from "module";
import JSZip from "jszip";
import initSqlJs from "sql.js";
import { buildApkg } from "@/lib/anki";

const require = createRequire(import.meta.url);
const sqlJsConfig = { locateFile: () => require.resolve("sql.js/dist/sql-wasm.wasm") };

describe("buildApkg", () => {
  it("produces a deck with notes, cards and audio media", async () => {
    const audio = Buffer.from("fake mp3 bytes").toString("base64");
    const bytes = await buildApkg(
      "Test deck",
      [
        { front: "今日 [きょう]は<いい>天気", back: "**bold** note", audioBase64: audio, audioName: "bot_audio_0.mp3" },
        { front: "second", back: "" },
      ],
      sqlJsConfig,
    );

    const zip = await JSZip.loadAsync(bytes);
    expect(JSON.parse(await zip.file("media")!.async("string"))).toEqual({ "0": "bot_audio_0.mp3" });
    expect(await zip.file("0")!.async("string")).toBe("fake mp3 bytes");

    const SQL = await initSqlJs(sqlJsConfig);
    const db = new SQL.Database(await zip.file("collection.anki2")!.async("uint8array"));
    const notes = db.exec("SELECT flds, csum FROM notes ORDER BY id")[0].values;
    expect(notes).toHaveLength(2);
    expect(String(notes[0][0])).toContain("[sound:bot_audio_0.mp3]");
    expect(String(notes[0][0])).toContain("&lt;いい&gt;");
    expect(String(notes[0][0])).toContain("<b>bold</b>");
    expect(Number(notes[0][1])).toBeGreaterThan(0);
    expect(db.exec("SELECT count(*) FROM cards")[0].values[0][0]).toBe(2);
    const decks = JSON.parse(String(db.exec("SELECT decks FROM col")[0].values[0][0]));
    expect(Object.values(decks).map((d) => (d as { name: string }).name)).toContain("Test deck");
  });
});
