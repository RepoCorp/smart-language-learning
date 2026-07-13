export function normalizeWordAnswer(value: string): string {
  return value.trim();
}

export function isLetter(value: string): boolean {
  return /^[A-Za-zÀ-ÖØ-öø-ÿ]$/.test(value);
}

export function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function matchLetterCase(letter: string, reference: string): string {
  return reference === reference.toUpperCase() ? letter.toUpperCase() : letter.toLowerCase();
}

export function nextLetterSuggestions(correctLetter: string, offset: number): string[] {
  if (!isLetter(correctLetter)) {
    return correctLetter ? [correctLetter] : [];
  }
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const correctLower = correctLetter.toLowerCase();
  const wrongLetters = alphabet
    .split("")
    .filter((letter) => letter !== correctLower)
    .slice(offset % 20, (offset % 20) + 2);
  const suggestions = [
    matchLetterCase(correctLower, correctLetter),
    ...wrongLetters.map((letter) => matchLetterCase(letter, correctLetter)),
  ];
  const correctIndex = offset % suggestions.length;
  const correct = suggestions.shift();
  if (!correct) {
    return [];
  }
  suggestions.splice(correctIndex, 0, correct);
  return suggestions;
}

export function hintOptionLabel(value: string): string {
  if (value === " ") {
    return "␠";
  }
  if (value === "\t") {
    return "⇥";
  }
  return value;
}

function isSingleBaseLetterForNextDiacritic(value: string, acceptedAnswer: string, expectedAnswer: string): boolean {
  if (value.length !== acceptedAnswer.length + 1) {
    return false;
  }
  if (!value.startsWith(acceptedAnswer)) {
    return false;
  }
  const typedLetter = value.charAt(acceptedAnswer.length);
  const expectedLetter = expectedAnswer.charAt(acceptedAnswer.length);
  if (!isLetter(typedLetter) || !isLetter(expectedLetter)) {
    return false;
  }
  if (typedLetter === expectedLetter) {
    return false;
  }
  return stripDiacritics(expectedLetter).toLowerCase() === typedLetter.toLowerCase();
}

function isPendingUppercaseMismatch(value: string, acceptedAnswer: string, expectedAnswer: string): boolean {
  if (value.length !== acceptedAnswer.length + 1) {
    return false;
  }
  if (!value.startsWith(acceptedAnswer)) {
    return false;
  }
  const typedLetter = value.charAt(acceptedAnswer.length);
  const expectedLetter = expectedAnswer.charAt(acceptedAnswer.length);
  if (!isLetter(typedLetter) || !isLetter(expectedLetter)) {
    return false;
  }
  if (expectedLetter !== expectedLetter.toUpperCase() || expectedLetter === expectedLetter.toLowerCase()) {
    return false;
  }
  return typedLetter.toLowerCase() === expectedLetter.toLowerCase() && typedLetter !== expectedLetter;
}

export type PendingCaseMismatch = {
  typedLetter: string;
  expectedLetter: string;
  acceptedAnswer: string;
  mismatchIndex: number;
};

export type WordInputDecision =
  | {
    kind: "accept";
    nextAnswer: string;
  }
  | {
    kind: "hide_pending_case_mismatch";
    pendingCaseMismatch: PendingCaseMismatch;
  }
  | {
    kind: "accept_provisional";
    nextAnswer: string;
    provisionalBaseAnswer: string;
  }
  | {
    kind: "reject";
    fallbackAnswer: string;
    mismatchIndex: number;
    wrongText: string;
  };

export function resolveWordInputChange(params: {
  value: string;
  acceptedAnswer: string;
  expectedAnswer: string;
  provisionalBaseAnswer: string | null;
}): WordInputDecision {
  const {
    value,
    acceptedAnswer,
    expectedAnswer,
    provisionalBaseAnswer,
  } = params;

  if (expectedAnswer.startsWith(value)) {
    return {
      kind: "accept",
      nextAnswer: value,
    };
  }

  if (isPendingUppercaseMismatch(value, acceptedAnswer, expectedAnswer)) {
    return {
      kind: "hide_pending_case_mismatch",
      pendingCaseMismatch: {
        typedLetter: value.charAt(acceptedAnswer.length),
        expectedLetter: expectedAnswer.charAt(acceptedAnswer.length),
        acceptedAnswer,
        mismatchIndex: acceptedAnswer.length,
      },
    };
  }

  if (
    isSingleBaseLetterForNextDiacritic(value, acceptedAnswer, expectedAnswer)
  ) {
    return {
      kind: "accept_provisional",
      nextAnswer: value,
      provisionalBaseAnswer: acceptedAnswer,
    };
  }

  const fallbackAnswer = provisionalBaseAnswer && acceptedAnswer.startsWith(provisionalBaseAnswer)
    ? provisionalBaseAnswer
    : acceptedAnswer;
  const maxCompareLength = Math.min(value.length, expectedAnswer.length);
  let mismatchIndex = 0;
  while (mismatchIndex < maxCompareLength && value.charAt(mismatchIndex) === expectedAnswer.charAt(mismatchIndex)) {
    mismatchIndex += 1;
  }
  if (mismatchIndex >= maxCompareLength) {
    mismatchIndex = fallbackAnswer.length;
  }

  return {
    kind: "reject",
    fallbackAnswer,
    mismatchIndex,
    wrongText: value.slice(acceptedAnswer.length) || value.slice(fallbackAnswer.length) || value.slice(-1),
  };
}
