const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    background: './background.js',
    content: './content.js',
    popup: './popup.js'
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
        { 
          from: 'manifest.json', 
          to: 'manifest.json' 
        },
        { 
          from: 'popup.html', 
          to: 'popup.html' 
        },
        { 
          from: 'popup.css', 
          to: 'popup.css' 
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