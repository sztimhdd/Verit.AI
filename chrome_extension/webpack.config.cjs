const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  entry: {
    background: './background.js',
    'floating-card': './floating-card.js',
    content: './content.js'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  mode: 'production',
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          format: {
            comments: false,
          },
          compress: {
            drop_console: false,
            drop_debugger: true,
            pure_funcs: ['console.info', 'console.debug', 'console.warn']
          },
        },
        extractComments: false,
      }),
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.API_URL': JSON.stringify('http://localhost:4000')
    }),
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json' },
        { from: 'floating-card.html' },
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