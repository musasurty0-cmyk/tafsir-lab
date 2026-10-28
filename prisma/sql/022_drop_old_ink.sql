-- The old ink tables. Handwriting now lives in each page's realtime room on
-- Cloudflare (party/ink.ts, since 121fe91); all 15,656 strokes were copied
-- and checked identical in id and drawing order, and the owner confirmed
-- their ink after the switch. Nothing reads or writes these any more.
DROP TABLE IF EXISTS "InkStroke";
DROP TABLE IF EXISTS "InkHead";
DROP TABLE IF EXISTS "CanvasDrawing";
