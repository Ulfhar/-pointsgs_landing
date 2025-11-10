// Dark Mode Toggle
(function() {
  'use strict';

  // Initialize dark mode from localStorage or system preference
  const initDarkMode = () => {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    
    document.documentElement.setAttribute('data-theme', theme);
    updateDarkModeIcon(theme);
  };

  // Update dark mode icon based on current theme
  const updateDarkModeIcon = (theme) => {
    const toggleBtn = document.getElementById('darkModeToggle');
    if (!toggleBtn) return;

    const svg = toggleBtn.querySelector('svg');
    if (theme === 'dark') {
      // Sun icon for dark mode (to switch to light)
      svg.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
    } else {
      // Moon icon for light mode (to switch to dark)
      svg.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
    }
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateDarkModeIcon(newTheme);
  };

  // Initialize on load
  initDarkMode();

  // Add event listener
  const darkModeToggle = document.getElementById('darkModeToggle');
  if (darkModeToggle) {
    darkModeToggle.addEventListener('click', toggleDarkMode);
  }

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      const newTheme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      updateDarkModeIcon(newTheme);
    }
  });
})();

// Progress Indicator
(function() {
  'use strict';

  const updateProgress = () => {
    const progressBar = document.querySelector('.progress-fill');
    if (!progressBar) return;

    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollableHeight = documentHeight - windowHeight;
    const progress = (scrollTop / scrollableHeight) * 100;

    progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    
    // Update ARIA value
    const progressBarContainer = document.querySelector('.progress-bar');
    if (progressBarContainer) {
      progressBarContainer.setAttribute('aria-valuenow', Math.round(progress));
    }
  };

  // Throttle scroll events for better performance
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        updateProgress();
        ticking = false;
      });
      ticking = true;
    }
  });

  // Initial update
  updateProgress();
})();

// Back to Top Button
(function() {
  'use strict';

  const backToTopBtn = document.getElementById('backToTop');
  if (!backToTopBtn) return;

  const showHideButton = () => {
    if (window.pageYOffset > 300) {
      backToTopBtn.style.display = 'flex';
    } else {
      backToTopBtn.style.display = 'none';
    }
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  window.addEventListener('scroll', showHideButton);
  backToTopBtn.addEventListener('click', scrollToTop);

  // Initial check
  showHideButton();
})();

// Print/PDF Functionality
(function() {
  'use strict';

  const printBtn = document.getElementById('printBtn');
  if (!printBtn) return;

  const handlePrint = () => {
    // Add print class to body for print-specific styles
    document.body.classList.add('printing');
    
    // Trigger print dialog
    window.print();
    
    // Remove print class after a delay
    setTimeout(() => {
      document.body.classList.remove('printing');
    }, 1000);
  };

  printBtn.addEventListener('click', handlePrint);

  // Also support Ctrl/Cmd + P
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      handlePrint();
    }
  });
})();

// Keyboard Navigation Improvements
(function() {
  'use strict';

  // Improve focus visibility
  document.addEventListener('keydown', (e) => {
    // Show focus styles when using keyboard
    if (e.key === 'Tab') {
      document.body.classList.add('keyboard-navigation');
    }
  });

  document.addEventListener('mousedown', () => {
    document.body.classList.remove('keyboard-navigation');
  });

  // Skip link functionality
  const skipLink = document.querySelector('.skip-link');
  if (skipLink) {
    skipLink.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById('main-content');
      if (target) {
        target.focus();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
})();

// Tooltip Enhancement for Mobile
(function() {
  'use strict';

  // On touch devices, show tooltips on tap
  if ('ontouchstart' in window) {
    document.addEventListener('touchstart', (e) => {
      const tooltipElement = e.target.closest('[data-tooltip]');
      if (tooltipElement && !tooltipElement.classList.contains('tooltip-active')) {
        // Remove active class from other tooltips
        document.querySelectorAll('[data-tooltip].tooltip-active').forEach(el => {
          el.classList.remove('tooltip-active');
        });
        
        tooltipElement.classList.add('tooltip-active');
        
        // Remove after delay
        setTimeout(() => {
          tooltipElement.classList.remove('tooltip-active');
        }, 3000);
      }
    }, { passive: true });
  }
})();

// Smooth scroll for anchor links
(function() {
  'use strict';

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
})();

// Accessibility: Announce dynamic content changes
(function() {
  'use strict';

  // Create live region for screen readers
  const liveRegion = document.createElement('div');
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.className = 'sr-only';
  liveRegion.style.cssText = 'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;';
  document.body.appendChild(liveRegion);

  // Announce theme changes
  const darkModeToggle = document.getElementById('darkModeToggle');
  if (darkModeToggle) {
    const originalToggle = darkModeToggle.onclick;
    darkModeToggle.addEventListener('click', () => {
      setTimeout(() => {
        const theme = document.documentElement.getAttribute('data-theme');
        liveRegion.textContent = `Theme changed to ${theme} mode`;
      }, 100);
    });
  }
})();

