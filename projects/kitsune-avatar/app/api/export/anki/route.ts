import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import initSqlJs from "sql.js";
import JSZip from "jszip";

export interface AnkiCard {
  front: string;      // Japanese text (may include [sound:name.mp3])
  back: string;       // Explanation (markdown/html)
  audioBase64?: string; // MP3 as base64
  audioName?: string;   // e.g. "audio_0.mp3"
  isUserCard?: boolean; // grammar correction card
}

function csum(s: string): number {
  return parseInt(createHash("sha1").update(s, "utf8").digest("hex").slice(0, 8), 16);
}

function guid(i: number): string {
  return randomBytes(6).toString("base64url") + i;
}

function mdToHtml(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/^## (.+)$/gm, "<h3>$1</h3>")
    .replace(/^### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^- (.+)$/gm, "• $1")
    .replace(/\n{2,}/g, "<br><br>")
    .replace(/\n/g, "<br>");
}

export async function POST(req: NextRequest) {
  const { deckName, cards } = await req.json() as { deckName: string; cards: AnkiCard[] };

  const wasmBinary = readFileSync(
    join(process.cwd(), "node_modules/sql.js/dist/sql-wasm.wasm")
  ) as unknown as ArrayBuffer;
  const SQL = await initSqlJs({ wasmBinary });
  const db = new SQL.Database();

  const now = Math.floor(Date.now() / 1000);
  const MODEL_ID = now * 1000;
  const DECK_ID  = now * 1000 + 1;

  // Schema
  db.run(`CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null, ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null, models text not null, decks text not null, dconf text not null, tags text not null)`);
  db.run(`CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null)`);
  db.run(`CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null)`);
  db.run(`CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null, ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null)`);
  db.run(`CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null)`);
  db.run(`CREATE INDEX ix_notes_usn on notes (usn)`);
  db.run(`CREATE INDEX ix_cards_usn on cards (usn)`);
  db.run(`CREATE INDEX ix_revlog_usn on revlog (usn)`);
  db.run(`CREATE INDEX ix_cards_nid on cards (nid)`);
  db.run(`CREATE INDEX ix_cards_sched on cards (did, queue, due)`);
  db.run(`CREATE INDEX ix_revlog_cid on revlog (cid)`);
  db.run(`CREATE INDEX ix_notes_csum on notes (csum)`);

  const model = {
    id: String(MODEL_ID),
    name: "KitsuneCard",
    type: 0, mod: now, usn: -1, sortf: 0, did: DECK_ID,
    tmpls: [{
      name: "Card 1", ord: 0,
      qfmt: "{{Front}}",
      afmt: "{{FrontSide}}<hr id=answer>{{Back}}",
      bqfmt: "", bafmt: "", did: null, bfont: "", bsize: 0,
    }],
    flds: [
      { name: "Front", ord: 0, sticky: false, rtl: false, font: "Arial", size: 20, media: [] },
      { name: "Back",  ord: 1, sticky: false, rtl: false, font: "Arial", size: 20, media: [] },
    ],
    css: ".card{font-family:arial;font-size:16px;text-align:left;color:#111;background:#fff;padding:1em} h3{color:#7c3aed} b{color:#1e3a5f}",
    latexPre: "", latexPost: "", latexsvg: false,
    req: [[0, "any", [0]]],
  };

  const defaultDeck = {
    id: 1, name: "Default", desc: "", mod: now, usn: -1, conf: 1,
    dyn: 0, extendNew: 0, extendRev: 50, collapsed: false, browserCollapsed: false,
    newToday: [0, 0], revToday: [0, 0], lrnToday: [0, 0], timeToday: [0, 0],
  };

  const deck = {
    id: DECK_ID, name: deckName, desc: "", mod: now, usn: -1, conf: 1,
    dyn: 0, extendNew: 0, extendRev: 50, collapsed: false, browserCollapsed: false,
    newToday: [0, 0], revToday: [0, 0], lrnToday: [0, 0], timeToday: [0, 0],
  };

  const dconf = {
    "1": {
      id: 1, mod: 0, name: "Default", usn: -1, maxTaken: 60, autoplay: true, timer: 0, replayq: true,
      new: { bury: false, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 7], order: 1, perDay: 20 },
      lapse: { delays: [10], leechAction: 1, leechFails: 8, minInt: 1, mult: 0 },
      rev: { bury: false, ease4: 1.3, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, minSpace: 1, perDay: 200 },
    },
  };

  const conf = {
    nextPos: 1, estTimes: true, activeDecks: [DECK_ID], sortType: "noteFld",
    timeLim: 0, sortBackwards: false, addToCur: true, curDeck: DECK_ID,
    newBury: true, newSpread: 0, dueCounts: true,
    curModel: String(MODEL_ID), collapseTime: 1200,
  };

  db.run(
    `INSERT INTO col VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [1, now, now, now * 1000, 11, 0, -1, 0,
     JSON.stringify(conf),
     JSON.stringify({ [MODEL_ID]: model }),
     JSON.stringify({ 1: defaultDeck, [DECK_ID]: deck }),
     JSON.stringify(dconf),
     "{}"]
  );

  const mediaMap: Record<string, string> = {};
  const zip = new JSZip();

  let mediaIdx = 0;
  cards.forEach((card, i) => {
    const noteId = now * 10000 + i + 1;
    const cardId = noteId + 1000000;

    // Attach audio to front field
    let front = card.front;
    if (card.audioBase64 && card.audioName) {
      const zipKey = String(mediaIdx);
      const audioBytes = Uint8Array.from(atob(card.audioBase64), (c) => c.charCodeAt(0));
      zip.file(zipKey, audioBytes);
      mediaMap[zipKey] = card.audioName;
      front = `[sound:${card.audioName}]<br><br><div style="font-size:1.4em">${card.front}</div>`;
      mediaIdx++;
    }

    const back = card.back ? mdToHtml(card.back) : "";
    const flds = front + "\x1f" + back;

    db.run(
      `INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [noteId, guid(i), MODEL_ID, now, -1, "", flds, front, csum(front), 0, ""]
    );
    db.run(
      `INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [cardId, noteId, DECK_ID, 0, now, -1, 0, 0, i + 1, 0, 2500, 0, 0, 0, 0, 0, 0, ""]
    );
  });

  const dbData = db.export();
  db.close();

  zip.file("collection.anki2", dbData);
  zip.file("media", JSON.stringify(mediaMap));

  const apkgBuffer = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });

  return new NextResponse(new Blob([apkgBuffer.buffer as ArrayBuffer], { type: "application/zip" }), {
    headers: {
      "Content-Disposition": `attachment; filename="${encodeURIComponent(deckName)}.apkg"`,
    },
  });
}
