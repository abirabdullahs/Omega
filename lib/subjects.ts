export interface Chapter {
  id: string;
  name: string;
  paper: 1 | 2;
}

export interface Subject {
  id: string;
  name: string;
  chapters: Chapter[];
}

export const SUBJECTS: Subject[] = [
  {
    id: "physics",
    name: "পদার্থবিজ্ঞান (Physics)",
    chapters: [
      { id: "phy-1-1", name: "ভেক্টর (Vector)", paper: 1 },
      { id: "phy-1-2", name: "গতিবিদ্যা (Motion)", paper: 1 },
      { id: "phy-1-3", name: "নিউটনীয় বলবিদ্যা (Newtonian Mechanics)", paper: 1 },
      { id: "phy-1-4", name: "কাজ, শক্তি ও ক্ষমতা (Work, Energy and Power)", paper: 1 },
      { id: "phy-1-5", name: "মহাকর্ষ ও অভিকর্ষ (Gravitation and Gravity)", paper: 1 },
      { id: "phy-1-6", name: "পদার্থের গঠন ও ধর্ম (States of Matter and Properties)", paper: 1 },
      { id: "phy-1-7", name: "পর্যাবৃত্ত গতি (Periodic Motion)", paper: 1 },
      { id: "phy-1-8", name: "তরঙ্গ (Wave)", paper: 1 },
      { id: "phy-1-9", name: "আদর্শ গ্যাস ও গ্যাসের গতি তত্ত্ব (Ideal Gas and Kinetic Theory of Gases)", paper: 1 },
      { id: "phy-2-1", name: "তাপগতিবিদ্যা (Thermodynamics)", paper: 2 },
      { id: "phy-2-2", name: "স্থির তড়িৎ (Electrostatics)", paper: 2 },
      { id: "phy-2-3", name: "চল তড়িৎ (Current Electricity)", paper: 2 },
      { id: "phy-2-4", name: "তড়িৎ প্রবাহের চৌম্বক ক্রিয়া ও চুম্বকত্ব (Magnetic Effects of Current and Magnetism)", paper: 2 },
      { id: "phy-2-5", name: "তড়িৎ চুম্বকীয় আবেশ ও পরিবর্তী প্রবাহ (Electromagnetic Induction and Alternating Current)", paper: 2 },
      { id: "phy-2-6", name: "জ্যামিতিক আলোকবিজ্ঞান (Geometrical Optics)", paper: 2 },
      { id: "phy-2-7", name: "ভৌত আলোকবিজ্ঞান (Physical Optics)", paper: 2 },
      { id: "phy-2-8", name: "আধুনিক পদার্থবিজ্ঞানের সূচনা (Introduction to Modern Physics)", paper: 2 },
      { id: "phy-2-9", name: "পরমাণুর মডেল ও নিউক্লিয়ার পদার্থবিজ্ঞান (Atomic Model and Nuclear Physics)", paper: 2 },
      { id: "phy-2-10", name: "সেমিকন্ডাক্টর ও ইলেকট্রনিক্স (Semiconductors and Electronics)", paper: 2 },
      { id: "phy-2-11", name: "জ্যোতির্বিদ্যা (Astronomy)", paper: 2 },
    ],
  },
  {
    id: "chemistry",
    name: "রসায়ন (Chemistry)",
    chapters: [
      { id: "chem-1-1", name: "ল্যাবরেটরির নিরাপদ ব্যবহার (Safe Use of Laboratory)", paper: 1 },
      { id: "chem-1-2", name: "গুণগত রসায়ন (Qualitative Chemistry)", paper: 1 },
      { id: "chem-1-3", name: "মৌলের পর্যায়বৃত্ত ধর্ম ও রাসায়নিক বন্ধন (Periodic Properties and Chemical Bonding)", paper: 1 },
      { id: "chem-1-4", name: "রাসায়নিক পরিবর্তন (Chemical Changes)", paper: 1 },
      { id: "chem-1-5", name: "কর্মমুখী রসায়ন (Applied Chemistry)", paper: 1 },
      { id: "chem-2-1", name: "পরিবেশ রসায়ন (Environmental Chemistry)", paper: 2 },
      { id: "chem-2-2", name: "জৈব রসায়ন (Organic Chemistry)", paper: 2 },
      { id: "chem-2-3", name: "পরিমাণগত রসায়ন (Quantitative Chemistry)", paper: 2 },
      { id: "chem-2-4", name: "তড়িৎ রসায়ন (Electrochemistry)", paper: 2 },
      { id: "chem-2-5", name: "অর্থনৈতিক রসায়ন (Economic Chemistry)", paper: 2 },
    ],
  },
  {
    id: "math",
    name: "উচ্চতর গণিত (Higher Math)",
    chapters: [
      { id: "math-1-1", name: "ম্যাট্রিক্স ও নির্ণায়ক (Matrices and Determinants)", paper: 1 },
      { id: "math-1-2", name: "ভেক্টর (Vectors)", paper: 1 },
      { id: "math-1-3", name: "সরলরেখা (Straight Lines)", paper: 1 },
      { id: "math-1-4", name: "বৃত্ত (Circles)", paper: 1 },
      { id: "math-1-5", name: "বিন্যাস ও সমাবেশ (Permutations and Combinations)", paper: 1 },
      { id: "math-1-6", name: "ত্রিকোণমিতিক অনুপাত (Trigonometric Ratios)", paper: 1 },
      { id: "math-1-7", name: "সংযুক্ত কোণের ত্রিকোণমিতিক অনুপাত (Trigonometric Ratios of Associated Angles)", paper: 1 },
      { id: "math-1-8", name: "ফাংশন ও ফাংশুনের লেখচিত্র (Functions and Graphs)", paper: 1 },
      { id: "math-1-9", name: "অন্তরীকরণ (Differentiation)", paper: 1 },
      { id: "math-1-10", name: "যোজ্যতিন বা ইন্টিগ্রেশন (Integration)", paper: 1 },
      { id: "math-2-1", name: "বাস্তব সংখ্যা ও অসমতা (Real Numbers and Inequalities)", paper: 2 },
      { id: "math-2-2", name: "জটিল সংখ্যা (Complex Numbers)", paper: 2 },
      { id: "math-2-3", name: "বহুপদী ও বহুপদী সমীকরণ (Polynomials and Polynomial Equations)", paper: 2 },
      { id: "math-2-4", name: "কণিক (Conics)", paper: 2 },
      { id: "math-2-5", name: "বিপরীত ত্রিকোণমিতিক ফাংশন ও ত্রিকোণমিতিক সমীকরণ (Inverse Trigonometric Functions and Equations)", paper: 2 },
      { id: "math-2-6", name: "স্থিতিবিদ্যা (Statics)", paper: 2 },
      { id: "math-2-7", name: "গতিবিদ্যা (Dynamics)", paper: 2 },
      { id: "math-2-8", name: "সমতলীয় বস্তুকণা গতিবিদ্যা (Dynamics)", paper: 2 },
      { id: "math-2-9", name: "সমভাবনা বা সম্ভাব্যতা (Probability)", paper: 2 },
    ],
  },
  {
    id: "biology",
    name: "জীববিজ্ঞান (Biology)",
    chapters: [
      { id: "bio-1-1", name: "কোষ ও এর গঠন (Cell and its Structure)", paper: 1 },
      { id: "bio-1-2", name: "কোষ বিভাজন (Cell Division)", paper: 1 },
      { id: "bio-1-3", name: "কোষ রসায়ন (Cell Chemistry)", paper: 1 },
      { id: "bio-1-4", name: "অণুজীব (Microorganisms)", paper: 1 },
      { id: "bio-1-5", name: "শৈবাল ও ছত্রাক (Algae and Fungi)", paper: 1 },
      { id: "bio-1-6", name: "ব্রায়োফাইটা ও টেরিডোফাইটা (Bryophyta and Pteridophyta)", paper: 1 },
      { id: "bio-1-7", name: "নগ্নবীজী ও আবৃতবীজী উদ্ভিদ (Gymnosperm and Angiosperm)", paper: 1 },
      { id: "bio-1-8", name: "টিস্যু ও টিস্যু তন্ত্র (Tissue and Tissue System)", paper: 1 },
      { id: "bio-1-9", name: "উদ্ভিদ শারীরতত্ত্ব (Plant Physiology)", paper: 1 },
      { id: "bio-1-10", name: "উদ্ভিদ প্রজনন (Plant Reproduction)", paper: 1 },
      { id: "bio-1-11", name: "বায়োটেকনোলজি (Biotechnology)", paper: 1 },
      { id: "bio-1-12", name: "জীবের পরিবেশ, বিস্তার ও সংরক্ষণ (Environment, Distribution and Conservation of Organisms)", paper: 1 },
      { id: "bio-2-1", name: "প্রাণীর বিভিন্নতা ও শ্রেণিবিন্যাস (Diversity and Classification of Animals)", paper: 2 },
      { id: "bio-2-2", name: "পরিচিতি প্রাণী (Animal Organization)", paper: 2 },
      { id: "bio-2-3", name: "পরিপাক ও শোষণ (Digestion and Absorption)", paper: 2 },
      { id: "bio-2-4", name: "রক্ত ও সঞ্চালন (Blood and Circulation)", paper: 2 },
      { id: "bio-2-5", name: "শ্বসন ও শ্বাসক্রিয়া (Respiration and Breathing)", paper: 2 },
      { id: "bio-2-6", name: "বর্জ্য ও নিষ্কাশন (Excretion)", paper: 2 },
      { id: "bio-2-7", name: "চলন ও অঙ্গচালনা (Locomotion and Movement)", paper: 2 },
      { id: "bio-2-8", name: "সমন্বয় ও নিয়ন্ত্রণ (Coordination and Control)", paper: 2 },
      { id: "bio-2-9", name: "মানব জীবনের ধারাবাহিকতা (Continuity of Human Life)", paper: 2 },
      { id: "bio-2-10", name: "মানবদেহের প্রতিরক্ষা তন্ত্র (Human Immune System)", paper: 2 },
      { id: "bio-2-11", name: "জিনতত্ত্ব ও বিবর্তন (Genetics and Evolution)", paper: 2 },
      { id: "bio-2-12", name: "প্রাণীর আচরণ (Animal Behavior)", paper: 2 },
    ],
  },
];

export function findChapterMeta(chapterId: string): { subject: Subject; chapter: Chapter } | null {
  for (const subject of SUBJECTS) {
    const chapter = subject.chapters.find((c) => c.id === chapterId);
    if (chapter) return { subject, chapter };
  }
  return null;
}

export function getChapterName(chapterId: string): string {
  return findChapterMeta(chapterId)?.chapter.name || chapterId;
}
