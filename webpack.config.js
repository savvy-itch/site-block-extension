const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

const targetBrowser = process.env.TARGET_BROWSER || 'chrome';

module.exports = {
  mode: "development",
  entry: {
    background: './src/background.ts',
    content: './src/content.ts',
    options: './src/options.ts',
    blocked: './src/blocked.ts',
    about: './src/about.ts'
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    clean: true // Clean the output directory before emit.
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  devtool: 'cheap-module-source-map', // Avoids eval in source maps
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: `static/manifest.${targetBrowser}.json`,
          to: 'manifest.json'
        },
        {
          from: 'static',
          globOptions: {
            ignore: ['**/manifest.*.json']
          }
        },
        {
          from: 'node_modules/webextension-polyfill/dist/browser-polyfill.js'
        }
      ],
    })
  ]
};