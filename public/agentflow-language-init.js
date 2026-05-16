(function () {
  try {
    var language = localStorage.getItem('agentflow-language');
    if (language === 'ar') {
      document.documentElement.lang = 'ar';
      document.documentElement.dir = 'rtl';
    } else if (language === 'en') {
      document.documentElement.lang = 'en';
      document.documentElement.dir = 'ltr';
    } else if (language === 'fr') {
      document.documentElement.lang = 'fr';
      document.documentElement.dir = 'ltr';
    } else if (language === 'es') {
      document.documentElement.lang = 'es';
      document.documentElement.dir = 'ltr';
    }
  } catch {
    // Keep first paint safe even when localStorage is unavailable.
  }
})();
