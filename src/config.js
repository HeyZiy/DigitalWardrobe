export const FILES = {
  purchases: 'data/purchases.csv',
  inventory: 'data/inventory.csv',
  storage: 'data/storage.csv',
  discard: 'data/discard.csv',
};

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (typeof window !== 'undefined' ? window.API_BASE_URL : null) || '';

export const OPTIONS_SEASONS = ['春', '夏', '秋', '冬', '春秋', '秋冬', '四季通用'];

// 品类列表 - 默认列表，实际使用时会从 localStorage 读取用户自定义列表
export const DEFAULT_CATEGORIES = ['短袖', '长袖', '外套', '裤子', '短裤', '羽绒服', '秋衣', '内衣', '袜子', '鞋子', '配饰', '特殊'];

// 为了兼容性，OPTIONS_CATEGORIES 仍然导出，但组件应该使用 getCategories() 从 utils.js
export const OPTIONS_CATEGORIES = DEFAULT_CATEGORIES;

// 可输入下拉框选项 - 品牌
export const OPTIONS_BRANDS = ['优衣库', 'UNIQLO', 'ZARA', 'H&M', '耐克', 'NIKE', '阿迪达斯', 'ADIDAS', '李宁', '安踏', '太平鸟', '森马', '美特斯邦威', '以纯'];

// 可输入下拉框选项 - 购买途径
export const OPTIONS_SOURCES = ['淘宝', '京东', '拼多多', '1688', '小红书', '抖音', '快手', '线下', '其他'];

export const DEFAULT_BUDGETS = {
  yearly: 12000,
  monthly: 1000
};
