// ---------- Quranic Studies content ----------

// Surah Al-Fatiha verses (Uthmani script)
const SURAH_FATIHA = [
  {
    n: 1,
    ar: "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
    tl: "Bismi llāhi r-Raḥmāni r-Raḥīmi",
    en: "In the name of Allah — the Most Compassionate, the Most Merciful.",
  },
  {
    n: 2,
    ar: "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ",
    tl: "Al-ḥamdu lillāhi rabbi l-ʿālamīn",
    en: "All praise is for Allah — Lord of all worlds,",
  },
  {
    n: 3,
    ar: "ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
    tl: "Ar-Raḥmāni r-Raḥīmi",
    en: "the Most Compassionate, the Most Merciful,",
  },
  {
    n: 4,
    ar: "مَٰلِكِ يَوْمِ ٱلدِّينِ",
    tl: "Māliki yawmi d-dīn",
    en: "Master of the Day of Judgment.",
  },
  {
    n: 5,
    ar: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ",
    tl: "Iyyāka naʿbudu wa iyyāka nastaʿīn",
    en: "You alone we worship, and You alone we ask for help.",
  },
  {
    n: 6,
    ar: "ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ",
    tl: "Ihdinā ṣ-ṣirāṭa l-mustaqīm",
    en: "Guide us along the Straight Path,",
  },
  {
    n: 7,
    ar: "صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ",
    tl: "Ṣirāṭa lladhīna anʿamta ʿalayhim, ghayri l-maghḍūbi ʿalayhim wa lā ḍ-ḍāllīn",
    en: "the Path of those You have blessed — not of those who incur Your wrath, nor of those who go astray.",
  },
];

// Sidebar tree
const NOTEBOOK_TREE = [
  {
    id: "qs",
    title: "Quranic Studies",
    type: "notebook",
    open: true,
    children: [
      {
        id: "surahs",
        title: "Surahs in progress",
        type: "section",
        open: true,
        children: [
          {
            id: "fatiha",
            title: "Surah Al-Fatiha",
            type: "surah",
            open: true,
            children: [
              { id: "p-names",     title: "1. Names of the Surah", page: true, active: true },
              { id: "p-merits",    title: "2. Merits & virtues",   page: true },
              { id: "p-when",      title: "3. When were these Ayat revealed?", page: true },
              { id: "p-why",       title: "4. Asbāb al-Nuzūl — context of revelation", page: true },
              { id: "p-lang",      title: "5. Linguistic style & rhetoric", page: true },
              { id: "p-order",     title: "6. Order & structure in the Qur'an", page: true },
              { id: "p-message",   title: "7. Core message(s)", page: true },
              { id: "p-rulings",   title: "8. Jurisprudential rulings", page: true },
            ],
          },
          {
            id: "baqarah",
            title: "Surah Al-Baqarah",
            type: "surah",
            open: false,
            children: [
              { id: "b1", title: "1. Names of the Surah", page: true },
              { id: "b2", title: "2. Merits & virtues", page: true },
              { id: "b3", title: "3. When revealed", page: true },
            ],
          },
          {
            id: "ikhlas",
            title: "Surah Al-Ikhlāṣ",
            type: "surah",
            open: false,
            children: [
              { id: "k1", title: "1. Names of the Surah", page: true },
              { id: "k2", title: "2. Merits & virtues", page: true },
            ],
          },
        ],
      },
      {
        id: "methodology",
        title: "Methodology",
        type: "section",
        open: false,
        children: [
          { id: "m1", title: "Tafsīr framework (8-question)", page: true },
          { id: "m2", title: "Classical sources — reading list", page: true },
          { id: "m3", title: "Transliteration conventions", page: true },
        ],
      },
      {
        id: "refs",
        title: "References",
        type: "section",
        open: false,
        children: [
          { id: "r1", title: "Ibn Kathīr", page: true },
          { id: "r2", title: "Al-Qurṭubī", page: true },
          { id: "r3", title: "Al-Ṭabarī", page: true },
          { id: "r4", title: "Al-Rāzī", page: true },
        ],
      },
    ],
  },
  {
    id: "hadith",
    title: "Hadith Research",
    type: "notebook",
    open: false,
    children: [
      { id: "h1", title: "Ṣaḥīḥ al-Bukhārī — notes", page: true },
      { id: "h2", title: "Kitāb al-Īmān", page: true },
    ],
  },
  {
    id: "fiqh",
    title: "Uṣūl al-Fiqh",
    type: "notebook",
    open: false,
    children: [
      { id: "u1", title: "Definitions", page: true },
      { id: "u2", title: "Qiyās & analogical reasoning", page: true },
    ],
  },
];

// Shared — render a verse anchor inline inside a paragraph
const VerseAnchor = ({ vref: ref, onOpen }) => (
  <span
    className="verse-anchor"
    onClick={(e) => { e.stopPropagation(); onOpen(ref); }}
    title={`Open commentary for ${ref}`}
  >
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M7 4v16l5-4 5 4V4z"/>
    </svg>
    {ref}
  </span>
);

// The "Names of the Surah" document — one of the 8 questions
// Returns an array of blocks consumed by the editor.
const buildFatihaNamesDoc = (openVerse) => ([
  { type: "h2", id: "b1", text: "Question 1 of 8 · Quranic Studies Framework" },
  {
    type: "callout",
    id: "b2",
    icon: "Sparkle",
    text: (
      <>
        The Prophet ﷺ said Al-Fatiha is <em>Umm al-Kitāb</em> — the Mother of the Book. Before reading any
        tafsīr, we begin by asking: <b>what is this Surah called, and why?</b> Every name opens a window onto
        its function.
      </>
    ),
  },
  { type: "p", id: "b3", text: (
    <>
      Surah <b>Al-Fatiha</b> is the opening chapter of the Qur'an, consisting of seven short verses{" "}
      <VerseAnchor vref="Q 1:1–7" onOpen={openVerse} />. Classical scholars record more than twenty names for
      it — an abundance that, as Al-Suyūṭī notes, is itself an indication of its rank. The names fall into
      four clusters: names about <b>position</b>, names about <b>function</b>, names about <b>content</b>,
      and names of <b>praise</b>.
    </>
  )},

  { type: "verse", id: "v1", verse: SURAH_FATIHA[0], label: "Opening verse" },

  { type: "h3", id: "b4", text: "Names about position" },
  { type: "p", id: "b5", text: (
    <>
      <b>Fātiḥat al-Kitāb</b> (<i>The Opener of the Book</i>) — because the muṣḥaf begins with it. It is also
      called <b>Awwal al-Qur'ān</b> for the same reason, though scholars dispute whether it was the first
      Surah revealed or only the first by order of compilation (see{" "}
      <VerseAnchor vref="Q 96:1–5" onOpen={openVerse} /> for the first revelation).
    </>
  )},
  { type: "list", id: "b6", items: [
    <><b>Al-Fātiḥa</b> — "the opening"; its most widely-used name.</>,
    <><b>Fātiḥat al-Kitāb</b> — "the opener of the Book".</>,
    <><b>Awwal al-Qur'ān</b> — "the first of the Qur'an".</>,
  ]},

  { type: "h3", id: "b7", text: "Names about function — prayer" },
  { type: "p", id: "b8", text: (
    <>
      <b>Al-Ṣalāh</b> (<i>the prayer</i>) appears in a famous divine ḥadīth qudsī, where Allah says, "I have
      divided the prayer between Myself and My servant" — referring to Al-Fatiha. Its function is liturgical:
      without it, the ṣalāh is not valid.
    </>
  )},
  { type: "quote", id: "b9", text: (
    <>"There is no prayer for one who does not recite the opening of the Book." — reported by Al-Bukhārī &amp; Muslim, from ʿUbādah ibn al-Ṣāmit.</>
  )},
  { type: "list", id: "b10", items: [
    <><b>Al-Ṣalāh</b> — "the prayer" itself.</>,
    <><b>Al-Kāfiya</b> — "the sufficient", because it suffices as the recitation of the prayer.</>,
    <><b>Al-Wāfiya</b> — "the complete", because it is never split across rakʿahs.</>,
  ]},

  { type: "h3", id: "b11", text: "Names about content" },
  { type: "p", id: "b12", text: (
    <>
      <b>Umm al-Kitāb</b> (<i>the Mother of the Book</i>) — not because it is first, but because it contains
      the essence of what the Qur'an teaches: theology ({" "}
      <VerseAnchor vref="Q 1:1–4" onOpen={openVerse} />), worship and reliance ({" "}
      <VerseAnchor vref="Q 1:5" onOpen={openVerse} />), and the request for guidance ({" "}
      <VerseAnchor vref="Q 1:6–7" onOpen={openVerse} />). Al-Ṭabarī writes that every chapter of the Qur'an
      elaborates on something found in concentrated form here.
    </>
  )},
  { type: "list", id: "b13", items: [
    <><b>Umm al-Qur'ān</b> / <b>Umm al-Kitāb</b> — "the Mother of the Qur'an / the Book".</>,
    <><b>Al-Asās</b> — "the foundation".</>,
    <><b>Al-Sabʿ al-Mathānī</b> — "the seven oft-repeated" ({" "}
    <VerseAnchor vref="Q 15:87" onOpen={openVerse} />); repeated in every rakʿah of every prayer.</>,
  ]},

  { type: "verse", id: "v5", verse: SURAH_FATIHA[4], label: "Pivot of the Surah" },

  { type: "h3", id: "b14", text: "Names of praise & healing" },
  { type: "p", id: "b15", text: (
    <>
      <b>Al-Shifāʾ</b> (<i>the cure</i>) and <b>Al-Ruqyā</b> (<i>the incantation</i>) come from the ḥadīth of
      Abū Saʿīd al-Khudrī, in which a companion recited Al-Fatiha over a man stung by a scorpion, who then
      recovered. When the Prophet ﷺ heard of it, he smiled and said, <i>"How did you know it was a ruqyā?"</i>
    </>
  )},
  { type: "list", id: "b16", items: [
    <><b>Al-Shifāʾ</b> — "the cure".</>,
    <><b>Al-Ruqyā</b> — "the incantation / the healing recitation".</>,
    <><b>Al-Ḥamd</b> — "the praise", from its second verse{" "}
    <VerseAnchor vref="Q 1:2" onOpen={openVerse} />.</>,
    <><b>Al-Nūr</b> — "the light".</>,
  ]},

  { type: "divider", id: "b17" },

  { type: "h3", id: "b18", text: "Why so many names?" },
  { type: "p", id: "b19", text: (
    <>
      Ibn al-Qayyim offers the principle: <i>kathrat al-asmāʾ tadullu ʿalā sharaf al-musammā</i> — the
      multiplicity of names indicates the nobility of the named. Each name, he argues, captures a
      distinct facet of function. A Surah named only "the prayer" would obscure its role as cure; named only
      "the opener" would obscure its theological density.
    </>
  )},
  { type: "callout", id: "b20", icon: "Question", text: (
    <>
      <b>Open question →</b> Al-Qurṭubī lists twelve names; Al-Suyūṭī lists twenty-nine. Why the divergence?
      Is it a difference in <i>what counts as a name</i>, or in the sources each is drawing on?{" "}
      <span className="dim">Drafted for review with the study group.</span>
    </>
  )},

  { type: "p", id: "b21", text: (
    <>
      <span className="dim">Next → </span>
      <b>Question 2.</b> Merits &amp; virtues of Al-Fatiha — the narrations in Bukhārī, Muslim, and
      Al-Tirmidhī on reciting it in ṣalāh and as ruqyā.
    </>
  )},
]);

// Tafsir commentary for a given verse reference (shown in drawer)
const COMMENTARY = {
  "Q 1:1": {
    verse: SURAH_FATIHA[0],
    wbw: [
      { ar: "بِسْمِ", tr: "bismi", en: "In the name" },
      { ar: "ٱللَّهِ", tr: "llāhi", en: "of Allah" },
      { ar: "ٱلرَّحْمَٰنِ", tr: "r-Raḥmāni", en: "the Most Compassionate" },
      { ar: "ٱلرَّحِيمِ", tr: "r-Raḥīmi", en: "the Most Merciful" },
    ],
    sources: [
      {
        author: "Ibn Kathīr",
        years: "d. 774 AH · Damascus",
        initials: "IK",
        body: (
          <>
            <p>
              The companions began every matter with <span className="arabic">بِسْمِ ٱللَّهِ</span>, following the example of the Prophet ﷺ.
              Ibn Kathīr records the disagreement of the scholars over whether the Basmala is a standalone verse of Al-Fatiha or a verse
              of every Surah it precedes — the majority of the Ḥijāz (Mālik, the Qur'ān reciters of Medina) held it was not counted
              within Al-Fatiha, while the Kufans (al-Shāfiʿī, Aḥmad in one report) held that it was.
            </p>
            <p>
              On <span className="arabic">ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</span>: Al-Raḥmān denotes the one whose mercy is vast in this world,
              encompassing believer and unbeliever; Al-Raḥīm denotes the one whose mercy is <i>specific</i> to the believers in the
              Hereafter. Both names share the root r-ḥ-m, but the pattern <i>faʿlān</i> implies intensity and fullness, while <i>faʿīl</i>{" "}
              implies ongoing action.
            </p>
          </>
        ),
      },
      {
        author: "Al-Qurṭubī",
        years: "d. 671 AH · Córdoba",
        initials: "Q",
        body: (
          <>
            <p>
              Al-Qurṭubī devotes a long discussion to the <b>bāʾ</b> in <span className="arabic">بِسْمِ</span>. Is its meaning{" "}
              <i>istiʿāna</i> (seeking help — "by the name of Allah I begin") or <i>muṣāḥaba</i> (accompaniment — "with the name of Allah I begin")?
              He prefers the first, citing that the elided verb is contextual: <i>bismi llāhi aqraʾu</i>, <i>bismi llāhi ākulu</i>.
            </p>
          </>
        ),
      },
    ],
  },
  "Q 1:2": {
    verse: SURAH_FATIHA[1],
    wbw: [
      { ar: "ٱلْحَمْدُ", tr: "al-ḥamdu", en: "All praise" },
      { ar: "لِلَّهِ", tr: "lillāhi", en: "belongs to Allah" },
      { ar: "رَبِّ", tr: "rabbi", en: "Lord" },
      { ar: "ٱلْعَٰلَمِينَ", tr: "l-ʿālamīn", en: "of all worlds" },
    ],
    sources: [
      {
        author: "Al-Ṭabarī",
        years: "d. 310 AH · Baghdad",
        initials: "Ṭ",
        body: (
          <>
            <p>
              <span className="arabic">ٱلْحَمْدُ</span> — with the definite article <b>al-</b> — is <i>istighrāq</i>: it exhausts every
              kind of praise for every reason. Al-Ṭabarī glosses the verse: <i>every praise, from every praiser, for every praised act,
              is ultimately owed to Allah alone</i>. The difference between <b>ḥamd</b> and <b>shukr</b>: shukr is gratitude for a favor
              received; ḥamd is praise for the praiseworthy attributes of the praised, whether or not one has personally benefited.
            </p>
            <p>
              <b>Rabb al-ʿĀlamīn</b> — "Lord of all worlds". The ʿālamīn are every community of created beings: the angelic realm, jinn,
              humans, and — as Ibn ʿAbbās is reported to have said — every species that inhabits a world.
            </p>
          </>
        ),
      },
      {
        author: "Al-Rāzī",
        years: "d. 606 AH · Herāt",
        initials: "R",
        body: (
          <>
            <p>
              Al-Rāzī, ever the theologian, asks why the Surah opens with praise rather than with a command. His answer: because <i>maʿrifa
              precedes ʿibāda</i> — one must know whom one worships before worshipping. The first three verses are cognitive (who Allah is);
              the fourth is eschatological (when we will meet Him); only then does verse five turn to worship and reliance.
            </p>
          </>
        ),
      },
    ],
  },
  "Q 1:5": {
    verse: SURAH_FATIHA[4],
    wbw: [
      { ar: "إِيَّاكَ", tr: "iyyāka", en: "You alone" },
      { ar: "نَعْبُدُ", tr: "naʿbudu", en: "we worship" },
      { ar: "وَإِيَّاكَ", tr: "wa-iyyāka", en: "and You alone" },
      { ar: "نَسْتَعِينُ", tr: "nastaʿīn", en: "we ask for help" },
    ],
    sources: [
      {
        author: "Ibn Kathīr",
        years: "d. 774 AH · Damascus",
        initials: "IK",
        body: (
          <>
            <p>
              The fronting of the object <span className="arabic">إِيَّاكَ</span> before the verb is a rhetorical device of{" "}
              <i>ḥaṣr</i> (exclusivity): <i>You — and only You — do we worship</i>. Classical Arabic syntax is object-last; inverting it
              signals restriction.
            </p>
            <p>
              The shift from the third person (verses 1–4: "praise is for Him") to the second person ("You") is the{" "}
              <b>iltifāt</b> of the Surah — the rhetorical turn. Having established who Allah is, the worshipper now addresses Him
              directly. Ibn Kathīr notes that this is the pivot on which the whole Surah swings.
            </p>
          </>
        ),
      },
    ],
  },
  "Q 1:1–7": {
    verse: SURAH_FATIHA[0],
    wbw: null,
    sources: [
      {
        author: "Surah overview",
        years: "Al-Fatiha · 7 āyāt · Makkī (majority view)",
        initials: "§",
        body: (
          <>
            <p>
              Al-Fatiha is the opening Surah of the Qur'an and is recited in every rakʿah of every obligatory prayer. The majority
              hold it is Makkan, though a minority (Mujāhid, al-Ḥusayn ibn al-Faḍl) hold it is Madanī, and a third group (Ibn ʿAbbās
              in one riwāya) hold it was revealed twice.
            </p>
            <p>
              Its structure divides in two: the first half (verses 1–4) is praise and theology — what the worshipper says <i>of</i>{" "}
              Allah. The second half (verses 5–7) is petition — what the worshipper asks <i>from</i> Allah. Verse 5 stands at the hinge,
              containing both worship and supplication.
            </p>
          </>
        ),
      },
    ],
  },
  "Q 1:6–7": {
    verse: SURAH_FATIHA[5],
    wbw: [
      { ar: "ٱهْدِنَا", tr: "ihdinā", en: "Guide us" },
      { ar: "ٱلصِّرَٰطَ", tr: "ṣ-ṣirāṭa", en: "the path" },
      { ar: "ٱلْمُسْتَقِيمَ", tr: "l-mustaqīm", en: "the straight" },
    ],
    sources: [
      {
        author: "Al-Qurṭubī",
        years: "d. 671 AH · Córdoba",
        initials: "Q",
        body: (
          <>
            <p>
              The request is not for <i>new</i> guidance alone but for <i>thabāt</i> — firmness on the guidance one already has. The
              believer who already prays is still commanded to ask <span className="arabic">ٱهْدِنَا</span> seventeen times a day.
              Al-Qurṭubī: the heart turns; only constant asking keeps it on the path.
            </p>
            <p>
              <b>Al-ṣirāṭ al-mustaqīm</b> — glossed by the Prophet ﷺ, in the narration of al-Tirmidhī, as the Qur'an itself, the rope
              extended from heaven to earth.
            </p>
          </>
        ),
      },
    ],
  },
  "Q 15:87": {
    verse: { n: 87, ar: "وَلَقَدْ ءَاتَيْنَٰكَ سَبْعًا مِّنَ ٱلْمَثَانِى وَٱلْقُرْءَانَ ٱلْعَظِيمَ", tl: "Wa-laqad ātaynāka sabʿan mina l-mathānī wa-l-Qurʾāna l-ʿaẓīm", en: "We have certainly given you the seven oft-repeated verses and the great Qur'an." },
    wbw: null,
    sources: [
      {
        author: "Ibn Kathīr",
        years: "d. 774 AH · Damascus",
        initials: "IK",
        body: (
          <>
            <p>
              The majority of exegetes — Ibn ʿAbbās, Ibn Masʿūd, ʿAlī, and others — identified{" "}
              <b>al-sabʿ al-mathānī</b> (the seven oft-repeated) as Al-Fatiha. "Oft-repeated" because its seven verses are recited in
              every rakʿah. The verse is striking: Al-Fatiha is <i>gifted</i> alongside "the great Qur'an" — suggesting it has a station
              adjacent to the whole.
            </p>
          </>
        ),
      },
    ],
  },
  "Q 96:1–5": {
    verse: { n: 1, ar: "ٱقْرَأْ بِٱسْمِ رَبِّكَ ٱلَّذِى خَلَقَ", tl: "Iqraʾ bismi rabbika lladhī khalaq", en: "Read, in the name of your Lord who created." },
    wbw: null,
    sources: [
      {
        author: "Revelation context",
        years: "Al-ʿAlaq · first revelation",
        initials: "§",
        body: (
          <>
            <p>
              The first five verses of Al-ʿAlaq were the first to be revealed, on Jabal al-Nūr in the cave of Ḥirāʾ. This is why the
              claim that Al-Fatiha was the first Surah revealed <i>in full</i> is held as a minority view — the first verses revealed are
              from Al-ʿAlaq; the first complete <i>Surah</i> revealed is disputed.
            </p>
          </>
        ),
      },
    ],
  },
  "Q 1:4": {
    verse: SURAH_FATIHA[3],
    wbw: [
      { ar: "مَٰلِكِ", tr: "māliki", en: "Master / Owner" },
      { ar: "يَوْمِ", tr: "yawmi", en: "of the Day" },
      { ar: "ٱلدِّينِ", tr: "d-dīn", en: "of Judgment" },
    ],
    sources: [
      {
        author: "The qirāʾāt — Māliki vs. Maliki",
        years: "Reading tradition",
        initials: "§",
        body: (
          <>
            <p>
              Two of the seven canonical readings diverge here: ʿĀṣim (via Ḥafṣ) and al-Kisāʾī read <span className="arabic">مَٰلِكِ</span>{" "}
              ("owner / possessor"), while Nāfiʿ, Ibn Kathīr, and Abū ʿAmr read <span className="arabic">مَلِكِ</span> ("king"). Both are
              ways the Prophet ﷺ recited; both meanings are preserved. An <i>owner</i> implies absolute property-right; a <i>king</i>{" "}
              implies authority and command. On the Day of Judgment, Allah is both.
            </p>
          </>
        ),
      },
    ],
  },
  "Q 1:3": {
    verse: SURAH_FATIHA[2],
    wbw: null,
    sources: [
      {
        author: "Al-Rāzī",
        years: "d. 606 AH · Herāt",
        initials: "R",
        body: (
          <>
            <p>
              Why is <span className="arabic">ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</span> repeated from verse 1? Al-Rāzī's answer: because after
              hearing <span className="arabic">رَبِّ ٱلْعَٰلَمِينَ</span> — "Lord of all worlds" — the human heart contracts with awe at
              the scale of divine lordship. The repetition of mercy immediately after is a divine reassurance: this Lord is also the most
              merciful.
            </p>
          </>
        ),
      },
    ],
  },
};

Object.assign(window, { SURAH_FATIHA, NOTEBOOK_TREE, VerseAnchor, buildFatihaNamesDoc, COMMENTARY });
