// craco.config.js
const path = require("path");
require("dotenv").config();

// Check if we're in development/preview mode (not production build)
const isDevServer = process.env.NODE_ENV !== "production";

// Environment variable overrides
const config = {
    enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
    enableVisualEdits: isDevServer,
};

let setupDevServer;
let babelMetadataPlugin;

if (config.enableVisualEdits) {
    setupDevServer = require("./plugins/visual-edits/dev-server-setup");
    babelMetadataPlugin = require("./plugins/visual-edits/babel-metadata-plugin");
}

let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
    WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
    setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
    healthPluginInstance = new WebpackHealthPlugin();
}

// Resolve the ajv codegen path - works with both ajv@6 and ajv@8
// When nixpacks installs ajv@6, we need a fallback for ajv/dist/compile/codegen
function resolveAjvCodegenPath() {
    try {
          // Try ajv@8 path first (exists in our direct dep)
      return require.resolve('ajv/dist/compile/codegen');
    } catch (e) {
          // ajv@6 doesn't have this path - try finding it via schema-utils
      try {
              const schemaUtilsPkg = require.resolve('schema-utils/package.json');
              const schemaUtilsDir = path.dirname(schemaUtilsPkg);
              return path.join(schemaUtilsDir, 'node_modules/ajv/dist/compile/codegen');
      } catch (e2) {
              // Last resort: try react-scripts' ajv
            try {
                      const reactScriptsDir = path.dirname(require.resolve('react-scripts/package.json'));
                      return path.join(reactScriptsDir, 'node_modules/ajv/dist/compile/codegen');
            } catch (e3) {
                      return null;
            }
      }
    }
}

const webpackConfig = {
    eslint: {
          configure: {
                  extends: ["plugin:react-hooks/recommended"],
                  rules: {
                            "react-hooks/rules-of-hooks": "error",
                            "react-hooks/exhaustive-deps": "warn",
                  },
          },
    },
    webpack: {
          alias: {
                  '@': path.resolve(__dirname, 'src'),
          },
          configure: (webpackConfig) => {

            // Fix "Cannot find module 'ajv/dist/compile/codegen'" when ajv@6 is installed
            const ajvCodegenPath = resolveAjvCodegenPath();
                  if (ajvCodegenPath) {
                            webpackConfig.resolve = {
                                        ...webpackConfig.resolve,
                                        alias: {
                                                      ...(webpackConfig.resolve && webpackConfig.resolve.alias),
                                                      'ajv/dist/compile/codegen': ajvCodegenPath,
                                        },
                            };
                  }

            webpackConfig.watchOptions = {
                      ...webpackConfig.watchOptions,
                      ignored: [
                                  '**/node_modules/**',
                                  '**/.git/**',
                                  '**/build/**',
                                  '**/dist/**',
                                  '**/coverage/**',
                                  '**/public/**',
                                ],
            };

            if (config.enableHealthCheck && healthPluginInstance) {
                      webpackConfig.plugins.push(healthPluginInstance);
            }
                  return webpackConfig;
          },
    },
};

if (config.enableVisualEdits && babelMetadataPlugin) {
    webpackConfig.babel = {
          plugins: [babelMetadataPlugin],
    };
}

webpackConfig.devServer = (devServerConfig) => {
    if (config.enableVisualEdits && setupDevServer) {
          devServerConfig = setupDevServer(devServerConfig);
    }

    if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
          const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

      devServerConfig.setupMiddlewares = (middlewares, devServer) => {
              if (originalSetupMiddlewares) {
                        middlewares = originalSetupMiddlewares(middlewares, devServer);
              }
              setupHealthEndpoints(devServer, healthPluginInstance);
              return middlewares;
      };
    }

    return devServerConfig;
};

module.exports = webpackConfig;
