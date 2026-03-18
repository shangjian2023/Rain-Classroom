# ☔ 雨课堂作业截止日期查询插件

<p align="center">
  <img src="https://raw.githubusercontent.com/shangjian2023/Rain-Classroom/main/yuketang-deadline/icons/icon128.svg" width="80" height="80" alt="雨课堂作业截止日期查询插件">
</p>

<p align="center">
  <strong>🎯 一键查看雨课堂所有作业截止日期，再也不会错过DDL！</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Chrome-blue?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Chrome">
  <img src="https://img.shields.io/badge/Platform-Edge-blue?style=for-the-badge&logo=microsoft-edge&logoColor=white" alt="Edge">
  <img src="https://img.shields.io/badge/Manifest-V3-green?style=for-the-badge" alt="Manifest V3">
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="License">
</p>

<p align="center">
  <a href="#功能特点">功能特点</a> •
  <a href="#安装教程">安装教程</a> •
  <a href="#使用说明">使用说明</a> •
  <a href="#常见问题">常见问题</a>
</p>

---

## 📖 项目简介

**雨课堂作业截止日期查询插件**是一款专为使用雨课堂（清华大学教育技术）平台的学生设计的浏览器扩展。它可以帮助你：

- 📅 **查看所有作业截止日期**：一次性列出所有课程的作业DDL
- ⏰ **智能提醒**：桌面通知提醒即将到期的作业
- 📊 **清晰展示**：表格形式展示，一目了然
- 🔔 **持续监控**：自动刷新，保持最新状态

> 💡 **开发初衷**  
> 雨课堂的作业系统需要逐个进入每个课程才能看到作业截止日期，非常麻烦。这个插件可以一键查看所有课程的DDL，帮你合理安排时间，避免错过作业提交！

---

## ✨ 功能特点

| 功能 | 描述 |
|------|------|
| 📋 **作业列表展示** | 汇总显示所有课程的作业信息 |
| ⏰ **截止时间提醒** | 桌面弹窗通知即将到期的作业 |
| 🔢 **倒计时显示** | 精确到分钟显示剩余时间 |
| 🎨 **状态标识** | 绿色安全 / 黄色警告 / 红色紧急 |
| 🔄 **自动刷新** | 保持作业状态实时更新 |
| 🔐 **本地运行** | 数据不上传，保护隐私 |

### 截止时间状态

| 状态 | 条件 | 颜色 |
|------|------|------|
| 安全 | 剩余时间 > 24小时 | 绿色 |
| 警告 | 剩余时间 < 24小时 | 黄色 |
| 紧急 | 剩余时间 < 3小时 | 红色 |

---

## 🚀 安装教程

### 方法一：开发者模式（推荐）

1. **下载项目**
   ```bash
   git clone https://github.com/shangjian2023/Rain-Classroom.git
   ```
   或点击 **Code → Download ZIP** 下载解压

2. **打开Chrome扩展管理页**
   - 地址栏输入：`chrome://extensions/`
   - 或菜单 → 更多工具 → 扩展程序

3. **启用开发者模式**
   - 右上角开启 **开发者模式** 开关

4. **加载扩展**
   - 点击 **加载已解压的扩展程序**
   - 选择解压后的 `yuketang-deadline` 文件夹

5. **固定扩展**
   - 点击浏览器工具栏的拼图图标
   - 将插件固定到工具栏，方便使用

### 方法二：Chrome商店安装（即将上线）

> 计划上架Chrome Web Store，敬请期待！

---

## 📝 使用说明

### 基本使用

1. 登录 [雨课堂](https://www.yuketang.cn/)
2. 点击浏览器工具栏的插件图标
3. 等待加载完成，即可看到所有作业列表

### 操作示意

```
┌─────────────────────────────────────────────────────┐
│  📚 雨课堂作业列表              [刷新] [设置]      │
├─────────────────────────────────────────────────────┤
│  课程名称        作业名称        截止时间    状态   │
├─────────────────────────────────────────────────────┤
│  高等数学        习题三          03-15 14:30  ⚠️   │
│  线性代数        第五章作业       03-16 23:59  ✅   │
│  程序设计        实验报告         03-14 18:00  🔴   │
│  ...            ...              ...          ...  │
├─────────────────────────────────────────────────────┤
│  📊 共有 12 项作业，其中 3 项即将截止             │
│  下次刷新时间：14:30                               │
└─────────────────────────────────────────────────────┘
```

### 桌面通知

- 当有作业即将截止时，会弹出桌面通知
- 可在设置中调整通知提醒时间

---

## 📁 项目结构

```
yuketang-deadline/
├── manifest.json          # 扩展配置文件（Manifest V3）
├── background.js          # 后台服务脚本
├── content.js             # 页面内容脚本
├── popup.html             # 弹窗页面
├── popup.js               # 弹窗交互逻辑
├── styles.css             # 样式文件
├── icons/                 # 扩展图标
│   ├── icon16.svg
│   ├── icon48.svg
│   └── icon128.svg
└── README.md
```

---

## 🔧 技术栈

| 技术 | 说明 |
|------|------|
| **Manifest V3** | Chrome扩展最新规范 |
| **Chrome Storage API** | 本地数据存储 |
| **Chrome Alarms API** | 定时任务调度 |
| **Chrome Notifications API** | 桌面通知 |
| **Fetch API** | 网络请求处理 |

---

## ❓ 常见问题

### Q: 插件无法显示作业列表？

**A:** 请检查以下几点：
1. 确保已登录雨课堂账号（访问 `*.yuketang.cn` 域名）
2. 刷新雨课堂页面后重试
3. 检查浏览器控制台是否有错误信息

### Q: 提示"无法获取课程数据"？

**A:** 可能原因：
1. 雨课堂服务器暂时不可用
2. 账号登录状态过期，请重新登录
3. 网络连接问题

### Q: 支持哪些浏览器？

**A:** 目前支持：
- Google Chrome（推荐）
- Microsoft Edge（Chromium内核）
- 其他Chromium内核浏览器

---

## 🔄 更新日志

### v1.0.0 (2024-02-01)
- 🎉 首次发布
- ✨ 支持作业列表展示
- 🔔 支持桌面通知提醒
- 📊 支持截止时间状态标识
- 🎨 优化界面样式

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

---

## 📧 联系方式

如有问题或建议，欢迎：
- 提交 [Issue](https://github.com/shangjian2023/Rain-Classroom/issues)
- 发送邮件至：2045306963@qq.com

---

<p align="center">
  Made with ❤️ by a student, for students
</p>

<p align="center">
  ⭐ 如果这个项目对你有帮助，请给一个 Star！
</p>