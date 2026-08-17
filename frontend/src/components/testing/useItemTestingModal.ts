import { useState } from "react";

export type ItemTestingModalController = {
  isOpen: boolean;
  selectedActionKey: string;
  directTestReviewComplete: boolean;
  directTestResetVersion: number;
  open: () => void;
  close: () => void;
  selectAction: (actionKey: string) => void;
  completePractice: () => void;
  registerDirectTestAnswer: (correct: boolean) => Promise<void>;
};

export function useItemTestingModal(
  submitDirectTestAnswer: (correct: boolean) => Promise<void>,
): ItemTestingModalController {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedActionKey, setSelectedActionKey] = useState("test");
  const [directTestReviewComplete, setDirectTestReviewComplete] = useState(false);
  const [directTestResetVersion, setDirectTestResetVersion] = useState(0);

  const resetDirectTest = (): void => {
    setDirectTestReviewComplete(false);
    setDirectTestResetVersion((value) => value + 1);
  };

  const open = (): void => {
    setSelectedActionKey("test");
    resetDirectTest();
    setIsOpen(true);
  };

  const close = (): void => {
    setIsOpen(false);
    setDirectTestReviewComplete(false);
  };

  const selectAction = (actionKey: string): void => {
    setSelectedActionKey(actionKey);
    resetDirectTest();
  };

  const completePractice = (): void => {
    setSelectedActionKey("test");
    resetDirectTest();
  };

  const registerDirectTestAnswer = async (correct: boolean): Promise<void> => {
    if (directTestReviewComplete) {
      return;
    }
    await submitDirectTestAnswer(correct);
    setDirectTestReviewComplete(true);
  };

  return {
    isOpen,
    selectedActionKey,
    directTestReviewComplete,
    directTestResetVersion,
    open,
    close,
    selectAction,
    completePractice,
    registerDirectTestAnswer,
  };
}
