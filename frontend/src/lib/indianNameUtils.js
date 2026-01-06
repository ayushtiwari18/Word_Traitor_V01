import { uniqueNamesGenerator } from 'unique-names-generator';

const comicAdjectives = [
  "Chalu", "Bekaar", "Nautanki", "Jugaadu", "Fekuchand",
  "Kanjoos", "Padhaku", "Bhukkad", "Sust", "Tez",
  "Natkhat", "Shararati", "Masoom", "Gussail", "Rotlu",
  "ChupaRustam", "Vella", "Mastikhor", "Dhakkan", "Chapri",

  // NEW – Desi meme vibes
  "OverSmart", "FullOn", "Tapori", "Bindass", "Confused",
  "SadakChaap", "UltraPro", "TotalFilmy", "HalfEngineer",
  "Lallu", "HeroNo1", "Mental", "FundaLess", "DesiBoy",
  "DesiGirl", "Legendary", "Aalsi", "MadAngle", "KyaScene"
];


const indianNames = [
  "Pappu", "Raju", "BabuBhaiya", "Kachra", "Circuit",
  "Vasooli", "Gungun", "Chinku", "Pinku", "Titu",
  "Goli", "Chacha", "Mausi", "Bhabi", "Dost",
  "Padosi", "Majnu", "Uday", "CrimeMaster", "Chatur",

  // NEW – Bollywood & meme legends
  "Baburao", "Shyam", "RajuBhai",
  "Munna", "BhaiMBBS",
  "Khiladi", "Prem",
  "Singham",
  "Kalmuhi", "Teja",
  "Jethalal", "TarakMehta", "Popatlal", "Bhide",
  "Champak", "Bagha",
  "GopiBahuu",
  "Amitabh",
  "Shaktimaan",
  "Gabbar",
  "Mogambo",
  "BhoolBhulaiya",
  "PK",
  "VickyDonor",
  "PinkiMeme",
  "DollyChaiwala"
];


const suffixes = [
  // Original
  "KaLadka", "KiLadki", "KaBhai", "KiBehen",
  "Don", "IsBack", "Op", "Pro", "Noob",
  "420", "007", "King", "Queen",
  "Bhai", "Didi", "Uncle", "Aunty",
  "Ji", "Sir", "Madam",

  // NEW – Desi meme & internet vibes
  "Official",
  "RealIdSeAao",
  "Gaming",
  "YT",
  "Insta",
  "Vlogs",
  "Army",
  "Fan",
  "Stan",
  "Lover",
  "Legend",
  "UltraPro",
  "NoFilter",
  "FullPower",
  "OnFire",
  "OPAF",
  "Max",
  "Prime",

  // Bollywood & desi flavour
  "Returns",
  "TheBoss",
  "TheReal",
  "Khiladi",
  "Baazigar",
  "HeroNo1",
  "Dangerous",

  // Funny everyday Indian suffixes
  "Wala",
  "Seeker",
  "Hunter",
  "Master",
  "Expert",
  "No1",
  "Forever",
  "Only",
  "Zindabad"
];


export const generateComicIndianName = () => {
  // 50% chance of 2 words (Adjective + Name)
  // 50% chance of 3 words (Name + Suffix) or (Adjective + Name + Suffix)
  
  const config = {
    dictionaries: [comicAdjectives, indianNames, suffixes],
    separator: '',
    length: 2,
    style: 'capital', 
  };

  // Custom logic to mix it up for more "sentence-like" funny names
  const pattern = Math.random();
  
  if (pattern < 0.33) {
    // "Chalu Raju"
    return uniqueNamesGenerator({
      dictionaries: [comicAdjectives, indianNames],
      separator: ' ',
      length: 2,
      style: 'capital'
    });
  } else if (pattern < 0.66) {
    // "Raju Ka Ladka" (using Name + Suffix)
    return uniqueNamesGenerator({
        dictionaries: [indianNames, suffixes],
        separator: ' ',
        length: 2,
        style: 'capital'
    });
  } else {
    // "Nautanki BabuBhaiya 420"
    return uniqueNamesGenerator({
        dictionaries: [comicAdjectives, indianNames, suffixes],
        separator: ' ',
        length: 3,
        style: 'capital'
    });
  }
};
