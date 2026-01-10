import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

export default defineConfig({
    build: {
        outDir: 'dist',
        emptyOutDir: true, // Clean dist directory on build
        rollupOptions: {
            input: {
                popup: resolve(__dirname, 'src/popup.ts'),
                content: resolve(__dirname, 'src/content.ts'),
                background: resolve(__dirname, 'src/background.ts'),
                styles: resolve(__dirname, 'src/styles.css'),
            },
            output: {
                entryFileNames: '[name].js',
                assetFileNames: '[name].[ext]',
            },
        },
        minify: false, // Keep readable for debugging
        sourcemap: true,
    },
    plugins: [
        // Custom plugin to copy static files (replaces vite-plugin-static-copy)
        {
            name: 'copy-static-files',
            writeBundle() {
                // Copy manifest.json
                fs.copyFileSync(
                    resolve(__dirname, 'src/manifest.json'),
                    resolve(__dirname, 'dist/manifest.json')
                );

                // Copy popup.html
                fs.copyFileSync(
                    resolve(__dirname, 'src/popup.html'),
                    resolve(__dirname, 'dist/popup.html')
                );

                // Copy icons
                fs.copyFileSync(
                    resolve(__dirname, 'icons/icon_128.png'),
                    resolve(__dirname, 'dist/icon_128.png')
                );
                fs.copyFileSync(
                    resolve(__dirname, 'icons/icon_48.png'),
                    resolve(__dirname, 'dist/icon_48.png')
                );
                fs.copyFileSync(
                    resolve(__dirname, 'icons/icon_16.png'),
                    resolve(__dirname, 'dist/icon_16.png')
                );
            },
        },
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            '@shared': resolve(__dirname, '../shared'),
        },
    },
});