
  
  /**
   * Navigate to the next tab in sequence
   */
  export const goToNextTab = (  tabs: string[],activeTab: string, validateAndProceed: (nextTab: string) => void) => {
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex < tabs.length - 1) {
      validateAndProceed(tabs[currentIndex + 1]);
    }
  };
  
  /**
   * Navigate to the previous tab in sequence
   */
  export const goToPreviousTab = (  tabs: string[], activeTab: string, setActiveTab: (tab: string) => void) => {
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1]);
    }
  };
  