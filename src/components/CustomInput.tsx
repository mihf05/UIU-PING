import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, TextInputProps } from 'react-native';
import { Theme } from './Theme';

interface CustomInputProps extends TextInputProps {
  label: string;
  error?: string;
}

export const CustomInput: React.FC<CustomInputProps> = ({
  label,
  error,
  secureTextEntry,
  style,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, isFocused && styles.labelFocused]}>{label}</Text>
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          error ? styles.inputError : null,
        ]}
      >
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={Theme.colors.textMuted}
          secureTextEntry={secureTextEntry}
          {...props}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Theme.spacing.md,
    width: '100%',
  },
  label: {
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginBottom: Theme.spacing.xs,
    marginLeft: 4,
  },
  labelFocused: {
    color: Theme.colors.primary,
  },
  inputContainer: {
    backgroundColor: '#0F1524',
    borderWidth: 1.5,
    borderColor: Theme.colors.cardBorder,
    borderRadius: Theme.roundness.medium,
    paddingHorizontal: Theme.spacing.md,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputFocused: {
    borderColor: Theme.colors.primary,
  },
  inputError: {
    borderColor: Theme.colors.error,
  },
  input: {
    fontFamily: Theme.fonts.regular,
    fontSize: 16,
    color: Theme.colors.textPrimary,
    padding: 0,
    flex: 1,
    height: '100%',
  },
  errorText: {
    color: Theme.colors.error,
    fontSize: 12,
    marginTop: Theme.spacing.xs,
    marginLeft: 4,
  },
});
