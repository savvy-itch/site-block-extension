const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: "development",
  entry: {
    background: './src/background.ts',
    options: './src/options.ts'
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
        {from: 'static'}
        // { from: 'blocked.html', to: '.' },
        // { from: 'popup.css', to: '.' },
      ],
    })
  ]
};