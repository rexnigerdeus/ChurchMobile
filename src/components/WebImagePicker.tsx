// src/components/WebImagePicker.tsx
// Wrapper cross-platform pour la sélection d'image.
// Mobile → expo-image-picker (caméra + galerie).
// Web → <input type="file" accept="image/*"> qui retourne un blob URL.

import { Platform } from 'react-native';

export interface PickedImage {
  uri: string;
  width?: number;
  height?: number;
  type?: string;
  fileName?: string;
  fileSize?: number;
  // web-only
  blob?: Blob;
}

export async function pickImage(options: {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
  source?: 'gallery' | 'camera';
} = {}): Promise<PickedImage | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      document.body.appendChild(input);

      input.onchange = () => {
        const file = input.files?.[0];
        document.body.removeChild(input);
        if (!file) {
          resolve(null);
          return;
        }
        const uri = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          resolve({
            uri,
            width: img.naturalWidth,
            height: img.naturalHeight,
            type: file.type,
            fileName: file.name,
            fileSize: file.size,
            blob: file,
          });
        };
        img.onerror = () => {
          resolve({ uri, type: file.type, fileName: file.name, fileSize: file.size, blob: file });
        };
        img.src = uri;
      };

      input.oncancel = () => {
        document.body.removeChild(input);
        resolve(null);
      };

      input.click();
    });
  }

  // Mobile : import dynamique
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ImagePicker = require('expo-image-picker');

    // Demande des permissions selon la source
    if (options.source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[pickImage] Permission caméra refusée');
        return null;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[pickImage] Permission galerie refusée');
        return null;
      }
    }

    // Lance la caméra OU la galerie selon la source demandée
    const isCamera = options.source === 'camera';
    const result = isCamera
      ? await ImagePicker.launchCameraAsync({
          allowsEditing: options.allowsEditing ?? true,
          aspect: options.aspect ?? [1, 1],
          quality: options.quality ?? 0.7,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: options.allowsEditing ?? true,
          aspect: options.aspect ?? [1, 1],
          quality: options.quality ?? 0.7,
        });

    if (result.canceled || !result.assets || !result.assets[0]) return null;
    const a = result.assets[0];
    return {
      uri: a.uri,
      width: a.width,
      height: a.height,
      type: a.mimeType ?? 'image/jpeg',
      fileName: a.fileName ?? undefined,
      fileSize: a.fileSize ?? undefined,
    };
  } catch (e) {
    console.warn('[pickImage] expo-image-picker indisponible', e);
    return null;
  }
}

export async function uploadToSupabase(
  supabase: any,
  bucket: string,
  path: string,
  picked: PickedImage
): Promise<string> {
  try {
    let body: any;
    let contentType = picked.type || 'image/jpeg';

    if (Platform.OS === 'web' && picked.blob) {
      body = picked.blob;
    } else {
      // Récupère un blob depuis l'uri (file://)
      const res = await fetch(picked.uri);
      body = await res.blob();
      if (picked.type) contentType = picked.type;
    }

    const { error } = await supabase.storage.from(bucket).upload(path, body, {
      contentType,
      upsert: true,
    });
    if (error) {
      console.warn('[uploadToSupabase] storage error', error);
      throw new Error(error.message || `Bucket "${bucket}" introuvable ou upload refusé`);
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    if (!data?.publicUrl) {
      throw new Error(`Impossible de récupérer l'URL publique du fichier uploadé`);
    }
    return data.publicUrl;
  } catch (e: any) {
    console.warn('[uploadToSupabase] failed', e?.message || e);
    throw e;
  }
}
