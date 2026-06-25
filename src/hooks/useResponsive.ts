// src/hooks/useResponsive.ts
// Helpers pour un layout mobile-first responsive.
// La PWA s'adresse d'abord aux smartphones ; sur tablette/desktop on élargit
// le conteneur principal et on adapte les paddings.

import { useWindowDimensions, Platform } from 'react-native';

export type DeviceClass = 'phone' | 'tablet' | 'desktop';

export function useResponsive() {
  const { width, height } = useWindowDimensions();

  // Breakpoints (mobile-first : on part du plus petit écran)
  const isPhone = width < 640;
  const isTablet = width >= 640 && width < 1024;
  const isDesktop = width >= 1024;
  const isLargeScreen = isTablet || isDesktop;

  // Largeur max du contenu (centré sur grand écran, plein pot sur mobile)
  const contentMaxWidth: number = isDesktop ? 720 : isTablet ? 600 : 9999;

  // Paddings latéraux adaptatifs
  const horizontalPadding = isDesktop ? 32 : isTablet ? 24 : 16;

  return {
    width,
    height,
    isPhone,
    isTablet,
    isDesktop,
    isLargeScreen,
    isWeb: Platform.OS === 'web',
    contentMaxWidth,
    horizontalPadding,
  };
}
