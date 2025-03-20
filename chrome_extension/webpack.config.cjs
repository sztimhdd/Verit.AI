const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    popup: './popup.js',
    background: './background.js',
    content: './content.js'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  mode: 'production',
  optimization: {
    minimize: false
  },
  plugins: [
    new webpack.DefinePlugin({
      API_URL: JSON.stringify('http://localhost:4000')
    }),
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'popup.html', to: 'popup.html' },
        { 
          from: 'node_modules/crypto-js/crypto-js.js',
          to: 'crypto-js.js'
        },
        {
          from: 'node_modules/@google/generative-ai/dist/index.js',
          to: 'generative-ai.js'
        },
        {
          from: 'node_modules/@mozilla/readability/Readability.js',
          to: 'readability.js'
        }
      ]
    })
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: {
                  chrome: "88"
                }
              }]
            ]
          }
        }
      }
    ]
  }
}; 