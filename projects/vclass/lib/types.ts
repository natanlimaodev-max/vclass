/** A chat turn as exchanged between the browser and /api/chat. */
export interface Message {
  role: "user" | "assistant";
  content: string;
}
