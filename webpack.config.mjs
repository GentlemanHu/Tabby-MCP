import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
    target: 'node',
    entry: './src/index.ts',
    devtool: 'source-map',
    mode: 'production',
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, 'dist'),
        libraryTarget: 'commonjs2',
    },
    resolve: {
        extensions: ['.ts', '.js', '.json'],
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.scss$/,
                use: ['style-loader', 'css-loader', 'sass-loader'],
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    externals: [
        'tabby-core',
        'tabby-terminal',
        'tabby-settings',
        '@angular/core',
        '@angular/common',
        '@angular/forms',
        '@angular/animations',
        '@angular/platform-browser',
        '@ng-bootstrap/ng-bootstrap',
        'rxjs',
        'rxjs/operators',
        /^@angular\/.*/,
        /^tabby-.*/,
    ],
    optimization: {
        minimize: false,
    },
};
