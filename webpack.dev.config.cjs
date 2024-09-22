const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CompressionPlugin = require("compression-webpack-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
    watch: true,
    mode: 'development',
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
        path: path.resolve(__dirname + '/public'),
        filename: '[name].js',
        // filename: '[name].[contenthash].js',
        // clean: true
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
    devtool: 'eval-source-map',
    plugins: [
        new MiniCssExtractPlugin({
            filename: '[name].css',
            // filename: '[name].[contenthash].css',
        }),
        new CompressionPlugin({
            test: /\.js(\?.*)?$/i,
        }),
        new HtmlWebpackPlugin({
            // hash: true,
            filename: 'index.html',
            template: './src/index.html',
            base: '/'
        }),
        new CopyPlugin({
            patterns: [
                { from: "src/static" },
            ],
            options: {
                concurrency: 100,
            },
        }),
    ]
};