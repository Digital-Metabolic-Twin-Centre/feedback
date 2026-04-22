const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('@jest/types').Config.InitialOptions} */
const customJestConfig = {
  // simulate a browser-like environment
  testEnvironment: "jsdom",

  moduleFileExtensions: ["js", "jsx", "ts", "tsx"],
  testMatch: ["**/tests/**/*.(test|spec).(js|jsx|ts|tsx)"],


  // transform all JS/TS files (handled via next/babel preset)
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": "babel-jest",
  },

  // transform lucide-react ESM inside node_modules
  transformIgnorePatterns: [
    "node_modules/(?!(lucide-react|jose|next-auth|openid-client|react-markdown|remark.*|rehype.*|@panva/hkdf)/)"
  ],


  // mock non-JS imports and map TS path aliases
  moduleNameMapper: {
    // stub CSS/SASS imports
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",

    // force jose to use Node.js build instead of browser build
    "^jose": "<rootDir>/node_modules/jose/dist/node/cjs/index.js",

    // support @/foo imports (matches tsconfig.json paths)
    "^@/(.*)$": "<rootDir>/$1",
  },

  coverageProvider: "babel",
  setupFiles: ["<rootDir>/jest.setup.js"],
};

module.exports = createJestConfig(customJestConfig);
