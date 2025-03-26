const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  entry: {
    background: './src/background/background.js',
    'floating-card': './src/floating-card/floating-card.js',
    content: './src/content/content.js',
    popup: './public/popup.js'
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
      'process.env.API_URL': JSON.stringify('https://veritai-api.up.railway.app')
    }),
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json' },
        { from: 'public/popup.html', to: 'popup.html' },
        { from: 'src/floating-card/floating-card.html', to: 'floating-card.html' },
        // { from: 'public/_locales', to: '_locales' },
        { from: '_locales', to: '_locales' },
        { from: 'public/icons', to: 'icons' },
        { from: 'styles/popup.css', to: 'styles/popup.css' },
        { from: 'src/content/content.css', to: 'styles/content.css' },
        {
          from: 'node_modules/crypto-js/crypto-js.js',
          to: 'lib/crypto-js.js'
        },
        {
          from: 'node_modules/@google/generative-ai/dist/index.js',
          to: 'lib/generative-ai.js'
        },
        {
          from: 'node_modules/@mozilla/readability/Readability.js',
          to: 'lib/readability.js'
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
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  }
}; 