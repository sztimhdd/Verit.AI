const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  // ... (existing configuration)

  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "./chrome_extension/manifest.json", to: "manifest.json" },
        { from: "./_locales", to: "_locales" },
        // 其他文件...
      ],
    }),
  ],
}; 