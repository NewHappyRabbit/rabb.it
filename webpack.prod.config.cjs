const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const CompressionPlugin = require("compression-webpack-plugin");
const WebpackObfuscator = require('webpack-obfuscator');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
    watch: false,
    mode: 'production',
    entry: './src/app.js',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [
                    MiniCssExtractPlugin.loader, 'css-loader'
                ]
            },
        ]
    },
    output: {
        path: path.resolve(__dirname + '/public/dist'),
        filename: '[name].[contenthash].js',
        clean: true
    },
    optimization: {
        runtimeChunk: 'single',
        splitChunks: {
            cacheGroups: {
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendors',
                    chunks: 'all'
                }
            }
        }
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: '[name].[contenthash].css',
        }),
        new CompressionPlugin({
            test: /\.js(\?.*)?$/i,
        }),
        new WebpackObfuscator({
            rotateStringArray: true
        }),
        new HtmlWebpackPlugin({
            filename: path.resolve(__dirname, 'public/', 'index.html'),
            template: './src/index.html',
            base: '/'
        }),
        new CopyPlugin({
            patterns: [
                { from: "src/static", to: path.resolve(__dirname, 'public') },
            ],
            options: {
                concurrency: 100,
            },
        }),
    ]
};