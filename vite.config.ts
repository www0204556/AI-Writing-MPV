import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // This ensures that process.env.API_KEY in your code is replaced
      // by the actual environment variable value during the build.
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Polyfill process.env for other potential uses (though not recommended for secrets)
      'process.env': {} 
    },
    build: {
      target: 'esnext'
    }
  };
});