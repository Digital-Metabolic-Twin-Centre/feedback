import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock environment variables for tests
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-csrf-protection-testing-only';
process.env.NEXTAUTH_URL = 'http://localhost:3000';

// React 19 compatibility - provide React.act polyfill
import { act } from 'react';
if (!act) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  act = require('react-dom/test-utils').act;
}

// mock for NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data, init) => ({
      ...init,
      // This mimics the fetch Response object
      json: async () => data,
      status: init?.status || 200,
    }),
  },
}));

// stub out next-auth’s useSession
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

// polyfill window.matchMedia for jsdom
Object.defineProperty(global, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,           // or true if you want "mobile" initially
    media: query,
    onchange: null,
    addListener: () => {},    // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// polyfill Request and Response for Next.js API route tests
if (typeof global.Request === 'undefined') {
  global.Request = class {};
}
if (typeof global.Response === 'undefined') {
  global.Response = class {};
}