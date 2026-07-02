import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import { Theme } from './src/components/Theme';
import { StorageService } from './src/services/storage';
import { AuthService } from './src/services/auth';
import { NotificationService } from './src/services/notifications';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';

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

      // 2. Check if credentials exist and auto-login if possible
      const credentials = await StorageService.getCredentials();
      if (credentials) {
        console.log('[App] Saved credentials located. Verifying session...');
        await StorageService.addScraperLog('info', 'App launched. Checking session validity...');
        
        const sessionActive = await AuthService.ensureAuthenticated();
        if (sessionActive) {
          setIsAuthenticated(true);
          await StorageService.addScraperLog('info', 'Session automatically restored.');
        } else {
          console.log('[App] Session check failed, credentials present. User must re-login.');
          await StorageService.addScraperLog('warning', 'Saved session expired. Re-login required.');
        }
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
    <View style={styles.container}>
      {isAuthenticated ? (
        <DashboardScreen onLogout={handleLogout} />
      ) : (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}
    </View>
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
