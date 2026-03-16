# Quest TCG App

## Setup rápido

### 1. Instalar dependencias
```bash
npm install
```

### 2. Variables de entorno
El archivo `.env` ya tiene las credenciales. Para producción en Vercel, agregá estas variables en el dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 3. Configurar Google Auth en Supabase
1. Supabase Dashboard → Authentication → Providers → Google → Enable
2. Crear proyecto en Google Cloud Console → OAuth 2.0 credentials
3. Pegar Client ID y Secret en Supabase
4. Agregar en Authorized redirect URIs: `https://qattyrdmlbolocnzczos.supabase.co/auth/v1/callback`

### 4. Correr local
```bash
npm run dev
```

### 5. Deploy en Vercel
```bash
npm run build
# Subir carpeta `dist` a Vercel, o conectar el repo de GitHub
```

## Estructura
```
src/
  main.jsx        # Entry point
  App.jsx         # App principal + todas las pantallas
  AuthScreen.jsx  # Login / Registro / Google
  supabase.js     # Cliente de Supabase
```

## Próximos pasos (backend real)
- [ ] Tabla `posts` en Supabase con likes/saves reales
- [ ] Tabla `rankings` con puntos por torneo
- [ ] Tabla `cards` para el folder personal
- [ ] Storage para imágenes de posts
