import { uniqueNamesGenerator } from 'unique-names-generator';

const comicAdjectives = [
  "Chalu", "Bekaar", "Nautanki", "Jugaadu", "Fekuchand", 
  "Kanjoos", "Padhaku", "Bhukkad", "Sust", "Tez", 
  "Natkhat", "Shararati", "Masoom", "Gussail", "Rotlu",
  "ChupaRustam", "Vella", "Mastikhor", "Dhakkan", "Chapri"
];

const indianNames = [
  "Pappu", "Raju", "BabuBhaiya", "Kachra", "Circuit", 
  "Vasooli", "Gungun", "Chinku", "Pinku", "Titu",
  "Goli", "Chacha", "Mausi", "Bhabi", "Dost",
  "Padosi", "Majnu", "Uday", "CrimeMaster", "Chatur"
];

const suffixes = [
  "KaLadka", "KiLadki", "KaBhai", "KiBehen", "Don", 
  "IsBack", "Op", "Pro", "Noob", "420", 
  "007", "King", "Queen", "Bhai", "Didi", 
  "Uncle", "Aunty", "Ji", "Sir", "Madam"
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
