const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: "development",
  entry: './background.ts',
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "background.js",
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
        { from: 'blocked.html', to: '.' },
        { from: 'options.html', to: '.'},
        { from: 'popup.css', to: '.' },
      ]
    })
  ]
};