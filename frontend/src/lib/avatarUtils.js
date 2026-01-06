import { genConfig } from "react-nice-avatar";

// Lists of valid options for react-nice-avatar
const hairStyles = ["normal", "thick", "mohawk", "womanLong", "womanShort"];
const hatStyles = ["none", "beanie", "turban"];
const eyeStyles = ["circle", "oval", "smile"];
const glassesStyles = ["none", "round", "square"];
const earSizes = ["small", "big"];
const shirtStyles = ["hoody", "short", "polo"];
const noseStyles = ["short", "long", "round"];
const mouthStyles = ["laugh", "smile", "peace"];
const shirtColors = ["#9287FF", "#6BD9E9", "#FC909F", "#F4D150", "#77311D"];
const bgColors = ["#9287FF", "#6BD9E9", "#FC909F", "#F4D150", "#77311D"];

// Simple hash function to turn a string into a number
const hashCode = (str) => {
  let hash = 0;
  if (!str) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

// Deterministically pick an item from an array based on the seed
const pick = (arr, seedNumber, salt = 0) => {
  return arr[(seedNumber + salt) % arr.length];
};

export const generateAvatarFromSeed = (seed) => {
  if (!seed) return genConfig(); // Fallback to random if no seed

  const seedNum = hashCode(seed);

  return {
    sex: pick(["man", "woman"], seedNum, 1),
    faceColor: "#F9C9B6", // Standard face color for simplicity, or randomize too
    earSize: pick(earSizes, seedNum, 2),
    hairColor: "#000000",
    hairStyle: pick(hairStyles, seedNum, 3),
    hatStyle: pick(hatStyles, seedNum, 4),
    hatColor: "#D2EFF3",
    eyeStyle: pick(eyeStyles, seedNum, 5),
    glassesStyle: pick(glassesStyles, seedNum, 6),
    noseStyle: pick(noseStyles, seedNum, 7),
    mouthStyle: pick(mouthStyles, seedNum, 8),
    shirtStyle: pick(shirtStyles, seedNum, 9),
    shirtColor: pick(shirtColors, seedNum, 10),
    bgColor: pick(bgColors, seedNum, 11),
    shape: "circle",
  };
};
