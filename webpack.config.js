const path = require('path')
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');


const nodeConfig = {
  target: 'node',
  mode: 'production',
  entry: './src/jsfluids.js',
  context: path.resolve(__dirname, "."),
  module: {
    rules: [
      {
        test: /\.wasm$/,
        type: "javascript/auto",
        loader: "arraybuffer-loader"
      }
    ],
  },
  plugins: [
    new webpack.EnvironmentPlugin({
      WITH_ITHACAFV: false
    })
  ],
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: 'index.js',
    chunkFilename: '[name].index.js',
    libraryExport: 'default',
    library: 'jsfluids',
    libraryTarget: 'umd'
  },
}

const browserConfig = {
  target: 'web',
  mode: 'production',
  entry: {
    browser: './src/jsfluids.js'
  },
  context: path.resolve(__dirname, "."),
  module: {
    rules: [
      {
        test: /\.wasm$/,
        type: "javascript/auto",
        loader: "arraybuffer-loader"
      }
    ],
  },
  resolve: {
    extensions: ['.js'],
    fallback: {
      fs: false,
      path: false,
      crypto: false,
    },
  },
  plugins: [
    new webpack.EnvironmentPlugin({
      WITH_ITHACAFV: false
    })
  ],
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: '[name].js',
    chunkFilename: '[name].browser.js',
    libraryExport: 'default',
    library: 'jsfluids',
    libraryTarget: 'umd'
  },
}

module.exports = [nodeConfig, browserConfig];
