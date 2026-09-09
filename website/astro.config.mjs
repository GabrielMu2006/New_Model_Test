import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://gabrielmu2006.cn',
  base: '/New_Model_Test',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
