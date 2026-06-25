# Déploiement du PWA sur Vercel (app.gerermoneglise.com)

## Étape 1 : Créer le bucket Supabase (OBLIGATOIRE pour les photos)

Le SQL Editor de Supabase ne permet pas toujours de créer des buckets via `INSERT INTO storage.buckets`.
**Créez le bucket manuellement** :

1. Aller sur **Supabase Dashboard → Storage → New bucket**
2. Nom : `profile-photos`
3. **Public bucket** : ✅ Oui
4. File size limit : `5242880` (5 Mo)
5. Allowed MIME types : `image/jpeg, image/jpg, image/png, image/webp`
6. Cliquer **Create bucket**

Puis exécuter dans **SQL Editor** uniquement les politiques RLS du bucket :

```sql
DROP POLICY IF EXISTS "Users can upload their own profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile photos" ON storage.objects;

CREATE POLICY "Users can upload their own profile photo"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own profile photo"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own profile photo"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view profile photos"
  ON storage.objects FOR SELECT TO authenticated, anon
  USING (bucket_id = 'profile-photos');
```

## Étape 2 : Déployer le PWA sur Vercel

### 2a. Connexion Vercel

```bash
cd ChurchMobile
vercel login
```

### 2b. Premier déploiement (crée le projet Vercel)

```bash
vercel
```

Répondre aux questions :
- **Set up and deploy?** → Y
- **Which scope?** → votre compte
- **Link to existing project?** → N
- **Project name?** → `mon-eglise-app` (ou `churchmobile`)
- **Framework preset?** → Other (vercel.json gère la config)
- Vercel détectera automatiquement `vercel.json`

### 2c. Déploiement de production

```bash
vercel --prod
```

Récupérer l'URL générée (ex: `https://mon-eglise-app.vercel.app`).

## Étape 3 : Configurer le sous-domaine app.gerermoneglise.com

### 3a. Dans le Dashboard Vercel

1. Aller sur **https://vercel.com/dashboard**
2. Cliquer sur le projet `mon-eglise-app`
3. **Settings → Domains**
4. Ajouter `app.gerermoneglise.com`
5. Vercel affiche les enregistrements DNS à ajouter

### 3b. Configurer le DNS chez votre registrar

Ajouter un enregistrement **CNAME** :

```
Type   : CNAME
Host   : app
Value  : cname.vercel-dns.com
TTL    : Automatic (ou 3600)
```

### 3c. Vérifier

Après propagation DNS (quelques minutes à quelques heures) :
- `https://app.gerermoneglise.com` affiche le PWA
- Le manifest est accessible sur `https://app.gerermoneglise.com/manifest.json`
- Le service worker sur `https://app.gerermoneglise.com/sw.js`

## Étape 4 : Vérifier le PWA

1. Ouvrir `https://app.gerermoneglise.com` sur mobile Chrome/Safari
2. Le navigateur propose "Ajouter à l'écran d'accueil"
3. L'app s'ouvre en mode standalone (sans barre de navigation)

## Structure du build

```
ChurchMobile/
├── vercel.json          # Config Vercel (build + rewrites + headers)
├── app.json             # Config Expo (web.bundler = metro)
├── public/
│   ├── manifest.json    # PWA manifest
│   └── sw.js            # Service Worker
├── assets/              # Icônes PWA (copiées dans dist/assets/)
└── dist/                # Output du build (généré par expo export)
    ├── index.html
    ├── manifest.json
    ├── sw.js
    ├── _expo/           # JS bundle
    └── assets/          # Icônes
```