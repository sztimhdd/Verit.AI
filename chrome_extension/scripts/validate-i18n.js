const fs = require('fs');
const path = require('path');

// 验证国际化变量
function validateI18nVariables() {
  console.log('正在验证国际化变量...');
  
  // 读取 manifest.json
  const manifestPath = path.join(__dirname, '../manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  // 提取所有 __MSG_xxx__ 变量
  const manifestStr = JSON.stringify(manifest);
  const msgRegex = /__MSG_([a-zA-Z0-9_]+)__/g;
  const variables = new Set();
  let match;
  
  while ((match = msgRegex.exec(manifestStr)) !== null) {
    variables.add(match[1]);
  }
  
  console.log(`在 manifest.json 中找到 ${variables.size} 个国际化变量: ${Array.from(variables).join(', ')}`);
  
  // 获取所有语言目录
  const localesDir = path.join(__dirname, '../public/_locales');
  const langDirs = fs.readdirSync(localesDir).filter(file => 
    fs.statSync(path.join(localesDir, file)).isDirectory()
  );
  
  console.log(`找到 ${langDirs.length} 个语言: ${langDirs.join(', ')}`);
  
  // 检查每种语言是否定义了所有变量
  let hasErrors = false;
  
  for (const lang of langDirs) {
    const messagesPath = path.join(localesDir, lang, 'messages.json');
    if (!fs.existsSync(messagesPath)) {
      console.error(`错误: ${lang} 语言没有 messages.json 文件`);
      hasErrors = true;
      continue;
    }
    
    const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
    
    for (const variable of variables) {
      if (!messages[variable]) {
        console.error(`错误: ${lang}/messages.json 缺少 "${variable}" 变量的定义`);
        hasErrors = true;
      }
    }
  }
  
  if (hasErrors) {
    console.error('国际化变量验证失败!');
    process.exit(1);
  } else {
    console.log('国际化变量验证通过!');
  }
}

// 执行验证函数如果直接运行此文件
if (require.main === module) {
  validateI18nVariables();
}

// 导出函数供其他模块使用
module.exports = {
  validateI18nVariables
}; 