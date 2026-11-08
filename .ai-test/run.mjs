// One-off live check of the three Claude prompts (roast lines, CHOMP question box). Runs on a throwaway branch.
import { roastLines } from "../roast.mjs";
const recap = await fetch("https://raw.githubusercontent.com/Scheer1776/war-room-recaps/media/recaps/espn-478389994/week-8/recap.json").then(r => r.json());
for (let i = 0; i < 2; i++) console.log("ROAST", i, JSON.stringify(await roastLines(recap, m => console.log("  roast log:", m))));
const { default: handler } = await import("./ask.js");
const qs = ["Are you open on Christmas?", "Is the plant based burger vegan?", "I have a severe peanut allergy, is the Asian Chicken salad safe?", "Where do I park?", "How much is a chocolate shake?", "Can you book the back room for 25 people Saturday at 6?", "Write me a poem about pizza"];
for (const q of qs) {
  const req = { method: "POST", headers: { "x-forwarded-for": "1.2.3.4" }, body: { messages: [{ role: "user", content: q }] } };
  const out = await new Promise(res => handler(req, { statusCode: 0, setHeader() {}, end(b) { res(this.statusCode + " " + b); } }));
  console.log("CHOMP Q:", q, "\n  A:", out);
}
