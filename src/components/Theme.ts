export const Theme = {
  colors: {
    background: '#0B0F19',       // Premium ultra-dark slate
    cardBackground: '#161D30',   // Slightly lighter slate for cards
    cardBorder: '#232D45',       // Subtle border for high contrast
    
    // UIU Orange branding
    primary: '#FF6F00',          // Deep UIU Orange
    primaryGradient: ['#FF6F00', '#FF9F00'], // Radiant orange gradient
    primaryLight: 'rgba(255, 111, 0, 0.1)',
    
    // Status colours
    info: '#3B82F6',             // Radiant blue
    success: '#10B981',          // Emerald green
    warning: '#F59E0B',          // Warm amber
    error: '#EF4444',            // Vibrant red
    
    // Text colours
    textPrimary: '#F8FAFC',      // White
    textSecondary: '#94A3B8',    // Muted grey/blue
    textMuted: '#64748B',        // Muted grey for dates and timestamps
  },
  
  fonts: {
    regular: 'Google Sans',
    medium: 'Google Sans',
    bold: 'Google Sans',
  },
  
  roundness: {
    small: 8,
    medium: 12,
    large: 16,
    full: 9999,
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  }
};
