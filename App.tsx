import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import { Theme } from './src/components/Theme';
import { StorageService } from './src/services/storage';
import { AuthService } from './src/services/auth';
import { NotificationService } from './src/services/notifications';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';

import { SafeAreaProvider } from 'react-native-safe-area-context';

// Crucial: Import the background task registration globally so it registers when the JS bundle mounts.
import './src/services/background';

export default function App() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log('[App] Initializing Smart Scraper client...');
      
      // 1. Request notification permissions from device
      await NotificationService.requestPermissions();

      // 2. Check if credentials exist — if so, go straight to dashboard
      const credentials = await StorageService.getCredentials();
      if (credentials) {
        console.log('[App] Saved credentials located. Restoring session directly.');
        await StorageService.addScraperLog('info', 'App launched. Credentials found, restoring session.');
        setIsAuthenticated(true);
        
        // Silently re-authenticate in background (non-blocking)
        AuthService.ensureAuthenticated().then(async (valid) => {
          if (valid) {
            await StorageService.addScraperLog('info', 'Session automatically restored.');
          } else {
            console.log('[App] Background session refresh failed. User stays on dashboard with cached data.');
            await StorageService.addScraperLog('warning', 'Background session refresh failed. Using cached data.');
          }
        }).catch((err) => {
          console.warn('[App] Background auth check error:', err);
        });
      } else {
        console.log('[App] No credentials located. Directing to login.');
      }
    } catch (error) {
      console.error('[App] Initialization error:', error);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (checkingAuth) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.loadingText}>Connecting UCAM...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        {isAuthenticated ? (
          <DashboardScreen onLogout={handleLogout} />
        ) : (
          <LoginScreen onLoginSuccess={handleLoginSuccess} />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
  },
  loadingText: {
    marginTop: Theme.spacing.md,
    color: Theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
});
