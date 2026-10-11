-- An ayah or word can be opened two ways: in the page, with the rest of the
-- surah around it, or alone. Each is its own writing space: a text box placed
-- while the ayah stood alone would otherwise land on top of the neighbouring
-- ayat when the page is shown. NULL is the page view (every existing row);
-- 'alone' is the ayah on its own. Ink makes the same split through its layer key.
ALTER TABLE "StructuredNote" ADD COLUMN "layerView" TEXT;
