const baseUrl = process.env.CALENDAR_TICK_URL ?? "http://localhost:3000/api/internal/calendar/tick";
const secret = process.env.CALENDAR_TICK_SECRET;

if (!secret) {
  console.error("CALENDAR_TICK_SECRET is required.");
  process.exit(1);
}

const response = await fetch(baseUrl, {
  method: "POST",
  headers: { authorization: `Bearer ${secret}` },
});
const body = await response.text();
if (!response.ok) {
  console.error(`Calendar tick failed (${response.status}): ${body}`);
  process.exit(1);
}
console.log(body);
