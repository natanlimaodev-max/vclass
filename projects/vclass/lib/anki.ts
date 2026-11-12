import initSqlJs, { type SqlJsConfig } from "sql.js";
import JSZip from "jszip";

/**
 * Builds an Anki `.apkg` deck entirely in the browser (sql.js + jszip), so no
 * audio has to be uploaded to the server and there is no request size limit.
 */

export interface AnkiCard {
  front: string;      // Japanese text (may include [sound:name.mp3])
  back: string;       // Explanation (markdown/html)
  audioBase64?: string; // MP3 as base64
  audioName?: string;   // e.g. "audio_0.mp3"
  isUserCard?: boolean; // grammar correction card
}

/** Anki's checksum: first 8 hex digits of the SHA-1 of the sort field. */
async function csum(s: string): Promise<number> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  const hex = Array.from(new Uint8Array(digest).slice(0, 4), (b) => b.toString(16).padStart(2, "0")).join("");
  return parseInt(hex, 16);
}

function guid(i: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") + i;
}

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function mdToHtml(md: string): string {
  return escapeHtml(md)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/^## (.+)$/gm, "<h3>$1</h3>")
    .replace(/^### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^- (.+)$/gm, "• $1")
    .replace(/\n{2,}/g, "<br><br>")
    .replace(/\n/g, "<br>");
}

/**
 * @param sqlJsConfig how sql.js finds its WASM file. In the browser the default
 *   loads `/sql-wasm.wasm`, which `npm run copy-wasm` places in `public/`.
 */
export async function buildApkg(
  deckName: string,
  cards: AnkiCard[],
  sqlJsConfig: SqlJsConfig = { locateFile: () => "/sql-wasm.wasm" },
): Promise<Uint8Array> {
  const SQL = await initSqlJs(sqlJsConfig);
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
    // Legacy name kept on purpose: renaming would create a second note type in decks users already imported.
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
  for (const [i, card] of cards.entries()) {
    const noteId = now * 10000 + i + 1;
    const cardId = noteId + 1000000;

    // Attach audio to front field
    let front = escapeHtml(card.front);
    if (card.audioBase64 && card.audioName) {
      const zipKey = String(mediaIdx);
      zip.file(zipKey, base64ToBytes(card.audioBase64));
      mediaMap[zipKey] = card.audioName;
      front = `[sound:${card.audioName}]<br><br><div style="font-size:1.4em">${escapeHtml(card.front)}</div>`;
      mediaIdx++;
    }

    const back = card.back ? mdToHtml(card.back) : "";
    const flds = front + "\x1f" + back;

    db.run(
      `INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [noteId, guid(i), MODEL_ID, now, -1, "", flds, front, await csum(front), 0, ""]
    );
    db.run(
      `INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [cardId, noteId, DECK_ID, 0, now, -1, 0, 0, i + 1, 0, 2500, 0, 0, 0, 0, 0, 0, ""]
    );
  }

  const dbData = db.export();
  db.close();

  zip.file("collection.anki2", dbData);
  zip.file("media", JSON.stringify(mediaMap));

  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
