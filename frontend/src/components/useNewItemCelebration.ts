import { useState } from "react";

export function useNewItemCelebration() {
  const [showNewItemCelebration, setShowNewItemCelebration] = useState(false);

  const registerConfirmedNewItem = (result: { show_new_items_celebration: boolean }): void => {
    if (result.show_new_items_celebration) {
      setShowNewItemCelebration(true);
    }
  };

  return {
    showNewItemCelebration,
    registerConfirmedNewItem,
    dismissNewItemCelebration: () => setShowNewItemCelebration(false),
  };
}
