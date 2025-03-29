const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const rimraf = require('rimraf');

// 清理dist目录
console.log('🧹 清理dist目录...');
try {
  rimraf.sync(path.resolve(__dirname, '../dist'));
} catch (error) {
  console.error('❌ 清理dist目录失败:', error);
  process.exit(1);
}

// 运行webpack构建
console.log('🚀 开始构建扩展...');
try {
  execSync('npx webpack --config webpack.config.cjs', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
} catch (error) {
  console.error('❌ 构建失败:', error);
  process.exit(1);
}

// 检查必要文件是否存在
console.log('🔍 检查必要文件...');
const requiredFiles = [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.js',
  'popup.html',
  'floating-card.js',
  'floating-card.html',
  'styles/popup.css',
  'styles/floating-card.css',
  'styles/content.css',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png',
  '_locales/en/messages.json',
  '_locales/zh/messages.json'
];

const missingFiles = [];
const distPath = path.resolve(__dirname, '../dist');

for (const file of requiredFiles) {
  const filePath = path.join(distPath, file);
  if (!fs.existsSync(filePath)) {
    missingFiles.push(file);
  }
}

if (missingFiles.length > 0) {
  console.warn('⚠️ 以下文件缺失:');
  missingFiles.forEach(file => console.warn(`  - ${file}`));
} else {
  console.log('✅ 所有必要文件已生成');
}



console.log('🎉 构建完成!');
console.log('📌 加载扩展方法:');
console.log('1. 打开Chrome浏览器');
console.log('2. 访问 chrome://extensions');
console.log('3. 启用"开发者模式"');
console.log('4. 点击"加载已解压的扩展程序"');
console.log(`5. 选择以下目录: ${distPath}`); 