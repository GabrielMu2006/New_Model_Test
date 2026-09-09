import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://vibetest.gabrielmu2006.cn',
  base: '/',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
