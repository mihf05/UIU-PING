import React, { useState } from 'react';
import { StyleSheet, Text, View, KeyboardAvoidingView, Platform, ScrollView, Alert, Dimensions } from 'react-native';
import { Theme } from '../components/Theme';
import { CustomInput } from '../components/CustomInput';
import { CustomButton } from '../components/CustomButton';
import { AuthService } from '../services/auth';

const { width } = Dimensions.get('window');

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ studentId?: string; password?: string }>({});

  const handleLogin = async () => {
    // Basic validation
    const newErrors: typeof errors = {};
    if (!studentId.trim()) {
      newErrors.studentId = 'Student ID is required';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      console.log(`[LoginScreen] Directing login request for: ${studentId}`);
      const success = await AuthService.login(studentId.trim(), password);

      if (success) {
        onLoginSuccess();
      } else {
        Alert.alert('Login Failed', 'Invalid credentials or connection issue. Verify your details.');
      }
    } catch (err: any) {
      Alert.alert('System Error', err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.cardContainer}>
          {/* Logo / Header Area */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>U</Text>
            </View>
            <Text style={styles.title}>UIU PING</Text>
            <Text style={styles.subtitle}>Client-side automated portal updates</Text>
          </View>

          {/* Login Fields */}
          <View style={styles.formContainer}>
            <CustomInput
              label="Student ID"
              placeholder="e.g. 011 201 000"
              value={studentId}
              onChangeText={(text) => {
                setStudentId(text);
                if (errors.studentId) setErrors(prev => ({ ...prev, studentId: undefined }));
              }}
              error={errors.studentId}
              autoCapitalize="none"
              keyboardType="numeric"
            />

            <CustomInput
              label="UCAM Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
              }}
              error={errors.password}
              secureTextEntry
              autoCapitalize="none"
            />

            <CustomButton
              title="SECURE LOG IN"
              onPress={handleLogin}
              loading={loading}
              style={styles.loginButton}
            />
          </View>

          {/* Privacy Note */}
          <View style={styles.footerNoteContainer}>
            <Text style={styles.footerNoteText}>
              🔒 Fully Client-Side. Credentials are saved directly to SecureStore. No external servers or analytics are utilized.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Theme.spacing.lg,
  },
  cardContainer: {
    backgroundColor: Theme.colors.cardBackground,
    borderRadius: Theme.roundness.large,
    borderColor: Theme.colors.cardBorder,
    borderWidth: 1.5,
    padding: Theme.spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  logoText: {
    fontSize: 32,
    color: '#FFF',
    fontWeight: '800',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Theme.colors.textPrimary,
    fontFamily: Theme.fonts.bold,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.regular,
    marginTop: Theme.spacing.xs,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  loginButton: {
    marginTop: Theme.spacing.md,
  },
  footerNoteContainer: {
    marginTop: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.sm,
  },
  footerNoteText: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
