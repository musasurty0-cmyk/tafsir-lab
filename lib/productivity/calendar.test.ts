import { describe, expect, it } from "vitest";
import { checkUrl, eventsIn, parseCalendar } from "./calendar";

const TZ = `BEGIN:VTIMEZONE
TZID:Europe/London
BEGIN:DAYLIGHT
TZOFFSETFROM:+0000
TZOFFSETTO:+0100
DTSTART:19810329T010000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
TZNAME:BST
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0100
TZOFFSETTO:+0000
DTSTART:19961027T020000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
TZNAME:GMT
END:STANDARD
END:VTIMEZONE`;

const ics = (events: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//test//EN\r\n${TZ}\r\n${events}\r\nEND:VCALENDAR`.replace(/\r?\n/g, "\r\n");

const CAL = ics(`BEGIN:VEVENT
UID:weekly
SUMMARY:Football
LOCATION:Park
DTSTART;TZID=Europe/London:20261014T170000
DTEND;TZID=Europe/London:20261014T183000
RRULE:FREQ=WEEKLY
EXDATE;TZID=Europe/London:20261028T170000
END:VEVENT
BEGIN:VEVENT
UID:weekly
RECURRENCE-ID;TZID=Europe/London:20261104T170000
SUMMARY:Football (moved)
DTSTART;TZID=Europe/London:20261104T190000
DTEND;TZID=Europe/London:20261104T200000
END:VEVENT
BEGIN:VEVENT
UID:utc
SUMMARY:Dentist
DTSTART:20261102T093000Z
DTEND:20261102T100000Z
END:VEVENT
BEGIN:VEVENT
UID:summer
SUMMARY:Summer call
DTSTART:20261020T093000Z
DTEND:20261020T100000Z
END:VEVENT
BEGIN:VEVENT
UID:allday
SUMMARY:Trip
DTSTART;VALUE=DATE:20261030
DTEND;VALUE=DATE:20261101
END:VEVENT
BEGIN:VEVENT
UID:gone
SUMMARY:Cancelled thing
STATUS:CANCELLED
DTSTART:20261021T120000Z
DTEND:20261021T130000Z
END:VEVENT`);

describe("Apple Calendar", () => {
  const evs = eventsIn(parseCalendar(CAL), "2026-10-19", "2026-11-09");
  const by = (t: string) => evs.filter((e) => e.title === t);

  it("expands a weekly event, dropping excluded dates and moving changed ones", () => {
    expect(by("Football").map((e) => e.start)).toEqual(["2026-10-21T17:00"]);
    expect(by("Football (moved)").map((e) => [e.start, e.end])).toEqual([["2026-11-04T19:00", "2026-11-04T20:00"]]);
    expect(by("Football")[0].location).toBe("Park");
  });
  it("gives London wall-clock times either side of the clocks going back", () => {
    expect(by("Summer call")[0].start).toBe("2026-10-20T10:30");   // BST
    expect(by("Dentist")[0].start).toBe("2026-11-02T09:30");       // GMT
  });
  it("keeps all-day events as dates, end exclusive, and skips cancelled ones", () => {
    expect(by("Trip")[0]).toMatchObject({ allDay: true, start: "2026-10-30", end: "2026-11-01" });
    expect(by("Cancelled thing")).toEqual([]);
  });
  it("only returns what overlaps the range", () => {
    expect(eventsIn(parseCalendar(CAL), "2026-11-03", "2026-11-04")).toEqual([]);
  });
  it("accepts iCloud links only", () => {
    expect(checkUrl("webcal://p42-caldav.icloud.com/published/2/abc")).toBe("https://p42-caldav.icloud.com/published/2/abc");
    expect(checkUrl("https://evil.example.com/x.ics")).toBeNull();
    expect(checkUrl("https://icloud.com.evil.example/x")).toBeNull();
    expect(checkUrl("not a link")).toBeNull();
  });
});
