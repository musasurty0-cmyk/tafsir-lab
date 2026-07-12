/**
 * spa5k/tafsir_api edition catalog — English + Arabic editions.
 *
 * Generated from https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/editions.json
 * (duplicated language+name pairs collapsed to their first slug).
 *
 * Verse content lives at:
 *   https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/{slug}/{surah}/{ayah}.json
 */

export interface Spa5kEdition {
  slug:       string;
  name:       string;
  authorName: string;
  language:   "en" | "ar";
}

export const SPA5K_EDITIONS: Spa5kEdition[] = [
  { slug: "abu-bakr-jabir-al-jazairi", name: "Abu Bakr Jabir Al-Jazairi", authorName: "Abu Bakr Jabir Al-Jazairi", language: "ar" },
  { slug: "adwa-al-bayan", name: "Adwa' Al-Bayan", authorName: "Adwa' Al-Bayan", language: "ar" },
  { slug: "al-dur-al-masun-lil-samin-al-halabi", name: "Al Dur Al Masun Lil Samin Al Halabi", authorName: "Al Dur Al Masun Lil Samin Al Halabi", language: "ar" },
  { slug: "al-jadwal-fi-i-rab-al-quran", name: "Al Jadwal fi I'rab Al Quran", authorName: "Al Jadwal fi I'rab Al Quran", language: "ar" },
  { slug: "al-lubab-fi-ulum-al-kitab", name: "Al Lubab fi Ulum Al Kitab", authorName: "Al Lubab fi Ulum Al Kitab", language: "ar" },
  { slug: "al-nashr-li-ibn-al-jazari", name: "Al Nashr li Ibn Al Jazari", authorName: "Al Nashr li Ibn Al Jazari", language: "ar" },
  { slug: "al-qira-at-al-mawsoo-ah-al-qur-aniyyah", name: "Al Qira'at Al Mawsoo'ah Al Qur'aniyyah", authorName: "Al Qira'at Al Mawsoo'ah Al Qur'aniyyah", language: "ar" },
  { slug: "al-bahr-al-muhit", name: "Al-Bahr Al-Muhit", authorName: "Al-Bahr Al-Muhit", language: "ar" },
  { slug: "al-basit", name: "Al-Basit", authorName: "Al-Basit", language: "ar" },
  { slug: "al-durr-al-manthur", name: "Al-Durr Al-Manthur", authorName: "Al-Durr Al-Manthur", language: "ar" },
  { slug: "al-kashshaf-al-zamakhshari", name: "Al-Kashshaf Al-Zamakhshari", authorName: "Al-Kashshaf Al-Zamakhshari", language: "ar" },
  { slug: "al-muharrar-al-wajiz-ibn-atiyyah", name: "Al-Muharrar Al-Wajiz Ibn Atiyyah", authorName: "Al-Muharrar Al-Wajiz Ibn Atiyyah", language: "ar" },
  { slug: "al-muyassar-fi-al-gharib", name: "Al-Muyassar fi Al-Gharib", authorName: "Al-Muyassar fi Al-Gharib", language: "ar" },
  { slug: "al-wajiz-wahidi", name: "Al-Wajiz Wahidi", authorName: "Al-Wajiz Wahidi", language: "ar" },
  { slug: "alrab-al-quran-li-da-as", name: "Alrab Al-Quran li-Da'as", authorName: "Alrab Al-Quran li-Da'as", language: "ar" },
  { slug: "ar-tafsir-al-mukhtasar", name: "Arabic Al-Mukhtasar in interpreting the Noble Quran", authorName: "Tafsir Center for Quranic Studies", language: "ar" },
  { slug: "asseraj-fi-bayan-gharib-alquran", name: "Asseraj fi Bayan Gharib AlQuran", authorName: "Asseraj fi Bayan Gharib AlQuran", language: "ar" },
  { slug: "ayah-dependency-graphs", name: "Ayah Dependency Graphs", authorName: "Ayah Dependency Graphs", language: "ar" },
  { slug: "fath-al-bayan-li-al-qanuji", name: "Fath Al-Bayan li Al-Qanuji", authorName: "Fath Al-Bayan li Al-Qanuji", language: "ar" },
  { slug: "fath-al-qadir-al-shawkani", name: "Fath Al-Qadir Al-Shawkani", authorName: "Fath Al-Qadir Al-Shawkani", language: "ar" },
  { slug: "i-rab-al-quran-li-al-darwish", name: "I'rab Al Quran li Al Darwish", authorName: "I'rab Al Quran li Al Darwish", language: "ar" },
  { slug: "al-i-rab-al-muyassar", name: "Iraab Al-Muyassar", authorName: "Iraab Al-Muyassar", language: "ar" },
  { slug: "jamia-al-bayan-aliji", name: "Jamia Al-Bayan AlIji", authorName: "Jamia Al-Bayan AlIji", language: "ar" },
  { slug: "mahasin-al-ta-wil-al-qasimi", name: "Mahasin Al-Ta'wil Al-Qasimi", authorName: "Mahasin Al-Ta'wil Al-Qasimi", language: "ar" },
  { slug: "mawsoo-at-al-tafsir-al-ma-thoor", name: "Mawsoo'at Al-Tafsir Al-Ma'thoor", authorName: "Mawsoo'at Al-Tafsir Al-Ma'thoor", language: "ar" },
  { slug: "nazam-al-durar-al-biqa-i", name: "Nazam Al-Durar Al-Biqa'i", authorName: "Nazam Al-Durar Al-Biqa'i", language: "ar" },
  { slug: "tadabbur-wa-amal", name: "Tadabbur wa 'Amal", authorName: "Tadabbur wa 'Amal", language: "ar" },
  { slug: "ar-tafseer-al-qurtubi", name: "Tafseer Al Qurtubi", authorName: "Qurtubi", language: "ar" },
  { slug: "ar-tafseer-al-saddi", name: "Tafseer Al Saadi - Arabic", authorName: "Saddi", language: "ar" },
  { slug: "ar-tafsir-al-baghawi", name: "Tafseer Al-Baghawi", authorName: "Baghawy", language: "ar" },
  { slug: "ar-tafseer-tanwir-al-miqbas", name: "Tafseer Tanwir al-Miqbas", authorName: "Tanweer", language: "ar" },
  { slug: "tafsir-abi-al-su-ood", name: "Tafsir Abi Al-Suaood", authorName: "Tafsir Abi Al-Suaood", language: "ar" },
  { slug: "ar-tafsir-al-wasit", name: "Tafsir Al Wasit", authorName: "Waseet", language: "ar" },
  { slug: "tafsir-al-alusi", name: "Tafsir Al-Alusi", authorName: "Tafsir Al-Alusi", language: "ar" },
  { slug: "tafsir-al-baydawi", name: "Tafsir Al-Baydawi", authorName: "Tafsir Al-Baydawi", language: "ar" },
  { slug: "tafsir-al-mawardi", name: "Tafsir Al-Mawardi", authorName: "Tafsir Al-Mawardi", language: "ar" },
  { slug: "tafsir-al-nasafi", name: "Tafsir Al-Nasafi", authorName: "Tafsir Al-Nasafi", language: "ar" },
  { slug: "tafsir-al-razi", name: "Tafsir Al-Razi", authorName: "Tafsir Al-Razi", language: "ar" },
  { slug: "tafsir-al-sam-ani", name: "Tafsir Al-Sam'ani", authorName: "Tafsir Al-Sam'ani", language: "ar" },
  { slug: "tafsir-al-samarqandi", name: "Tafsir Al-Samarqandi", authorName: "Tafsir Al-Samarqandi", language: "ar" },
  { slug: "ar-tafsir-al-tabari", name: "Tafsir al-Tabari", authorName: "Tabari", language: "ar" },
  { slug: "ar-tafseer-tahrir-al-tanwir", name: "Tafsir al-Tahrir wa al-Tanwir", authorName: "Tafsir al-Tahrir wa al-Tanwir", language: "ar" },
  { slug: "ar-tafsir-al-tha-alibi", name: "Tafsir Al-Tha'alibi", authorName: "Tafsir Al-Tha'alibi", language: "ar" },
  { slug: "ar-tafsir-as-saadi", name: "Tafsir As-Saadi", authorName: "Tafsir As-Saadi", language: "ar" },
  { slug: "tafsir-ibn-abi-hatim", name: "Tafsir Ibn Abi Hatim", authorName: "Tafsir Ibn Abi Hatim", language: "ar" },
  { slug: "tafsir-ibn-abi-zamanin", name: "Tafsir Ibn Abi Zamanin", authorName: "Tafsir Ibn Abi Zamanin", language: "ar" },
  { slug: "tafsir-ibn-al-jawzi", name: "Tafsir Ibn Al-Jawzi", authorName: "Tafsir Ibn Al-Jawzi", language: "ar" },
  { slug: "tafsir-ibn-al-qayyim", name: "Tafsir Ibn Al-Qayyim", authorName: "Tafsir Ibn Al-Qayyim", language: "ar" },
  { slug: "tafsir-ibn-juzay", name: "Tafsir Ibn Juzay", authorName: "Tafsir Ibn Juzay", language: "ar" },
  { slug: "ar-tafsir-ibn-kathir", name: "Tafsir Ibn Kathir", authorName: "Hafiz Ibn Kathir", language: "ar" },
  { slug: "tafsir-ibn-uthaymeen", name: "Tafsir Ibn Uthaymeen", authorName: "Tafsir Ibn Uthaymeen", language: "ar" },
  { slug: "ar-tafsir-al-jalalayn", name: "Tafsir Jalalayn", authorName: "Jalal al-Din al-Mahalli and Jalal al-Din al-Suyuti", language: "ar" },
  { slug: "tafsir-makhi", name: "Tafsir Makhi", authorName: "Tafsir Makhi", language: "ar" },
  { slug: "ar-tafsir-muyassar", name: "Tafsir Muyassar", authorName: "المیسر", language: "ar" },
  { slug: "tahlil-kalimat-al-qur-an", name: "Tahlil Kalimat al-Qur'an", authorName: "Tahlil Kalimat al-Qur'an", language: "ar" },
  { slug: "en-al-qushairi-tafsir", name: "Al Qushairi Tafsir", authorName: "Al Qushairi Tafsir", language: "en" },
  { slug: "en-al-jalalayn", name: "Al-Jalalayn", authorName: "Al-Jalalayn", language: "en" },
  { slug: "en-asbab-al-nuzul-by-al-wahidi", name: "Asbab Al-Nuzul by Al-Wahidi", authorName: "Asbab Al-Nuzul by Al-Wahidi", language: "en" },
  { slug: "en-tafsir-al-mukhtasar", name: "English Al-Mukhtasar", authorName: "Tafsir Center for Quranic Studies", language: "en" },
  { slug: "en-kashani-tafsir", name: "Kashani Tafsir", authorName: "Kashani Tafsir", language: "en" },
  { slug: "en-kashf-al-asrar-tafsir", name: "Kashf Al-Asrar Tafsir", authorName: "Kashf Al-Asrar Tafsir", language: "en" },
  { slug: "en-tafsir-maarif-ul-quran", name: "Maarif-ul-Quran", authorName: "Mufti Muhammad Shafi", language: "en" },
  { slug: "tafsir-al-jalalayn", name: "Tafsir Al Jalalayn - English", authorName: "Tafsir Al Jalalayn - English", language: "en" },
  { slug: "en-tafsir-al-tustari", name: "Tafsir al-Tustari", authorName: "Tafsir al-Tustari", language: "en" },
  { slug: "en-tafisr-ibn-kathir", name: "Tafsir Ibn Kathir", authorName: "Hafiz Ibn Kathir", language: "en" },
  { slug: "en-tafsir-ibn-abbas", name: "Tanwîr al-Miqbâs min Tafsîr Ibn ‘Abbâs", authorName: "Tanwîr al-Miqbâs min Tafsîr Ibn ‘Abbâs", language: "en" },
  { slug: "en-tazkirul-quran", name: "Tazkirul Quran(Maulana Wahiduddin Khan)", authorName: "Maulana Wahid Uddin Khan", language: "en" },
];
