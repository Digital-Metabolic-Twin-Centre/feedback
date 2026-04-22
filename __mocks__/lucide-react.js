/* eslint-disable @typescript-eslint/no-unused-vars */
// export empty placeholders for all icons and components
module.exports = new Proxy({}, {
    get: (_target, _name) => () => null
  });
  