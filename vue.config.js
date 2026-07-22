const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const {BundleAnalyzerPlugin} = require('webpack-bundle-analyzer');

module.exports = {

    filenameHashing: false, //to avoid app.####.js
    productionSourceMap: true,

    //this is to avoid compiling a lot of builds when debugging
    configureWebpack: (config) => {

        if (process.env.NODE_ENV === 'development') {
            // See available sourcemaps:
            // https://webpack.js.org/configuration/devtool/#devtool
            // config.devtool = 'eval-source-map';
            config.devtool = 'source-map';
            // console.log(`NOTICE: vue.config.js directive: ${config.devtool}`)

            config.output.devtoolModuleFilenameTemplate = (info) => {
                const resPath = path.normalize(info.resourcePath);
                const isVue = resPath.match(/\.vue$/);
                const isGenerated = info.allLoaders;

                const generated = `webpack-generated:///${resPath}?${info.hash}`;
                const vuesource = `vue-source://${resPath}`;

                return isVue && isGenerated ? generated : vuesource;
            };

            config.output.devtoolFallbackModuleFilenameTemplate = 'webpack:///[resource-path]?[hash]';

            // Remove any BundleAnalyzerPlugin instances added by Vue CLI in debug mode
            if (process.env.VUE_APP_DEBUG === '1') {
                config.plugins = config.plugins.filter(
                    (p) => p.constructor.name !== 'BundleAnalyzerPlugin'
                );
            }
        }

        if (process.env.NODE_ENV === 'production') {

            if (process.env.VUE_APP_MODE === 'WEBVIEW') {

                // 1. Explicitly filter out any existing BundleAnalyzerPlugin/WorkboxPlugin instances
                config.plugins = config.plugins.filter(
                    (p) => p.constructor && ![
                        'BundleAnalyzerPlugin',
                        'GenerateSW',
                        'InjectManifest'
                    ].includes(p.constructor.name)
                );
                // // See available sourcemaps:
                // // https://webpack.js.org/configuration/devtool/#devtool
                config.devtool = 'source-map';

                //config.devtool = 'eval-source-map';
                // console.log(`NOTICE: vue.config.js directive: ${config.devtool}`)

                config.output.devtoolModuleFilenameTemplate = (info) => {
                    const resPath = path.normalize(info.resourcePath);
                    const isVue = resPath.match(/\.vue$/);
                    const isGenerated = info.allLoaders;

                    const generated = `webpack-generated:///${resPath}?${info.hash}`;
                    const vuesource = `vue-source://${resPath}`;

                    return isVue && isGenerated ? generated : vuesource;
                };

                config.output.devtoolFallbackModuleFilenameTemplate = 'webpack:///[resource-path]?[hash]';

                config.plugins = [...config.plugins
                    //how many files in the builds, 1 for single file
                    // new webpack.optimize.LimitChunkCountPlugin({
                    //     maxChunks: 7
                    // })
                ];

                config.optimization = {
                    splitChunks: {
                        cacheGroups: {
                            default: false,// disable the built-in groups, default & vendors (vendors is overwritten below)
                            app: {
                                test: /[\\/]src[\\/]/, name: 'app', chunks: 'all', priority: 90
                            },
                            capacitor: {
                                test: /[\\/]node_modules[\\/]@capacitor[\\/]/,
                                name: 'vendor-capacitor',
                                chunks: 'all',
                                priority: 80
                            }, vue: {
                                test: /[\\/]node_modules[\\/]@vue[\\/]/, name: 'vendor-vue', chunks: 'all', priority: 70
                            }, ionic: {
                                test: /[\\/]node_modules[\\/](@ionic|@ionic-native)[\\/]/,
                                name: 'vendor-ionic',
                                chunks: 'all',
                                priority: 60
                            }, vendor: {
                                test: /[\\/]node_modules[\\/]/, name: 'vendor-common', //enforce: true,
                                chunks: 'all', priority: 50
                            }
                        }
                    }
                };
            }

            if (process.env.VUE_APP_MODE === 'PWA') {
                //Filter out ANY existing BundleAnalyzerPlugin/WorkboxPlugin instances first
                config.plugins = config.plugins.filter(
                    (p) => p.constructor && ![
                        'BundleAnalyzerPlugin',
                        'GenerateSW',
                        'InjectManifest'
                    ].includes(p.constructor.name)
                );

                config.resolve = config.resolve || {};
                config.resolve.alias = {
                    ...(config.resolve.alias || {}),
                    '@capacitor/barcode-scanner': path.resolve(__dirname, 'src/services/pwa-stubs/barcode-scanner.js'),
                    '@capgo/capacitor-zip': path.resolve(__dirname, 'src/services/pwa-stubs/capacitor-zip.js'),
                    'ajv/dist/2020': path.resolve(__dirname, 'src/services/pwa-stubs/ajv-2020.js'),
                    'ajv-formats': path.resolve(__dirname, 'src/services/pwa-stubs/ajv-formats.js'),
                    'ajv-i18n': path.resolve(__dirname, 'src/services/pwa-stubs/ajv-i18n.js')
                };


                config.plugins = [...config.plugins,
                    new webpack.optimize.LimitChunkCountPlugin({
                        maxChunks: 8
                    }),
                    new webpack.IgnorePlugin({
                        resourceRegExp: /an-array-of-/
                    }),
                    new webpack.IgnorePlugin({
                        resourceRegExp: /fake-answer-service/
                    }),
                    new webpack.IgnorePlugin({
                        resourceRegExp: /an-array-of/
                    }),
                    new webpack.IgnorePlugin({
                        resourceRegExp: /^@capacitor\/barcode-scanner$/
                    }),
                    new webpack.IgnorePlugin({
                        resourceRegExp: /^@capgo\/capacitor-zip$/
                    }),
                    ...(process.env.VUE_APP_DEBUG !== '1' && process.env.VUE_APP_MODE === 'PWA' ? [
                        new BundleAnalyzerPlugin({
                            analyzerMode: 'static',
                            openAnalyzer: false,
                            reportFilename: './bundle-report.html',
                            defaultSizes: 'gzip'
                        }),
                        new TerserPlugin({
                            terserOptions: {
                                format: {comments: false},
                                compress: {
                                    drop_console: true,
                                    drop_debugger: true
                                }
                            },
                            extractComments: false
                        })
                    ] : [])
                ];


                config.optimization = {
                    minimize: process.env.VUE_APP_DEBUG !== '1',
                    splitChunks: {
                        cacheGroups: {
                            default: false,// disable the built-in groups, default & vendors (vendors is overwritten below)
                            capacitor: {
                                test: /[\\/]node_modules[\\/]@capacitor[\\/]/,
                                name: 'vendor-capacitor',
                                chunks: 'all',
                                priority: 90
                            }, vue: {
                                test: /[\\/]node_modules[\\/]@vue[\\/]/, name: 'vendor-vue', chunks: 'all', priority: 80
                            }, ionic: {
                                test: /[\\/]node_modules[\\/](@ionic|@ionic-native)[\\/]/,
                                name: 'vendor-ionic',
                                chunks: 'all',
                                priority: 70
                            }, ionicons: {
                                test: /[\\/]node_modules[\\/]ionicons[\\/]/,
                                name: 'vendor-common-ionicons',
                                chunks: 'all',
                                priority: 60
                            }, leaflet: {
                                test: /[\\/]node_modules[\\/](leaflet|leaflet\.fullscreen)[\\/]/,
                                name: 'vendor-common-leaflet',
                                chunks: 'all',
                                enforce: true,
                                priority: 55
                            }, vendor: {
                                test: /[\\/]node_modules[\\/]/, name: 'vendor-common', //enforce: true,
                                chunks: 'all', priority: 1
                            }
                        }
                    }
                };
            }
        }
    }, //the following is to make pinia work
    //see https://github.com/vuejs/pinia/issues/675
    chainWebpack: (config) => {
        config.module
            .rule('mjs')
            .test(/\.mjs$/)
            .type('javascript/auto')
            .include.add(/node_modules/)
            .end();
    }, pwa: {
        //workboxPluginMode: 'GenerateSW',
        assetsVersion: '76.1.0', themeColor: '#673C90', msTileColor: '#FFFFFF'
    }
};
