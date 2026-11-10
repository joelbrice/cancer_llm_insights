// Expo's default Metro config auto-detects the pnpm workspace (packages/shared is resolved from source).
const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);
